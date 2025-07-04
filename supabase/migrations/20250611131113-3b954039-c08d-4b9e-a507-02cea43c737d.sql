
-- Verificar e ajustar a estrutura da tabela matchmaking_queue
-- Primeiro, vamos garantir que a coluna existe com o nome correto
ALTER TABLE public.matchmaking_queue 
ADD COLUMN IF NOT EXISTS idjogopleiteado integer DEFAULT 1;

-- Se a coluna idJogoPleiteado existir (com maiúscula), vamos renomeá-la
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'matchmaking_queue' 
               AND column_name = 'idJogoPleiteado') THEN
        ALTER TABLE public.matchmaking_queue 
        RENAME COLUMN "idJogoPleiteado" TO idjogopleiteado;
    END IF;
END $$;

-- Atualizar a função join_matchmaking_queue para usar o nome correto da coluna
CREATE OR REPLACE FUNCTION public.join_matchmaking_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    current_user_id uuid;
    v_id_jogo_pleiteado integer;
    queue_count integer;
    rows_affected integer;
BEGIN
    -- 1. Obter o ID do usuário da sessão atual
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
    END IF;

    -- 2. Verificar se o usuário já está na fila com status 'searching'
    IF EXISTS (SELECT 1 FROM matchmaking_queue WHERE user_id = current_user_id AND status = 'searching') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário já está na fila');
    END IF;

    -- 3. Para este jogo de dominó, vamos usar um idjogopleiteado fixo (1)
    v_id_jogo_pleiteado := 1;

    -- 4. Insere ou atualiza o registro do usuário na fila
    INSERT INTO matchmaking_queue (user_id, status, idjogopleiteado)
    VALUES (current_user_id, 'searching', v_id_jogo_pleiteado)
    ON CONFLICT (user_id) DO UPDATE SET
        status = 'searching',
        idjogopleiteado = v_id_jogo_pleiteado,
        updated_at = NOW();

    -- 5. Contar quantos usuários estão agora procurando pelo mesmo jogo
    SELECT COUNT(*) INTO queue_count
    FROM matchmaking_queue
    WHERE status = 'searching' AND idjogopleiteado = v_id_jogo_pleiteado;

    -- 6. Retornar sucesso com a contagem de jogadores para aquele jogo específico
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Entrou na fila com sucesso',
        'idjogopleiteado', v_id_jogo_pleiteado,
        'queue_count', queue_count
    );

END;
$function$;

-- Atualizar a função create_game_when_ready para usar o nome correto da coluna
CREATE OR REPLACE FUNCTION public.create_game_when_ready()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    target_game_id bigint;
    queue_users uuid[];
    new_game_id uuid;
    user_id uuid;
    pos integer;
BEGIN
    -- Encontra um jogo que tenha pelo menos 4 jogadores esperando
    SELECT idjogopleiteado INTO target_game_id
    FROM matchmaking_queue 
    WHERE status = 'searching' 
    GROUP BY idjogopleiteado 
    HAVING COUNT(*) >= 4 
    LIMIT 1;
    
    -- Se não há jogo com 4+ jogadores, retorna erro
    IF target_game_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not enough players for any game');
    END IF;
    
    -- Pega exatamente 4 jogadores do mesmo jogo (ordenados por created_at)
    SELECT ARRAY(
        SELECT mq.user_id 
        FROM matchmaking_queue mq 
        WHERE mq.status = 'searching' 
        AND mq.idjogopleiteado = target_game_id
        ORDER BY mq.created_at 
        LIMIT 4
    ) INTO queue_users;
    
    -- Cria novo jogo
    INSERT INTO games (status, prize_pool, entry_fee) 
    VALUES ('waiting', 4.0, 1.10) 
    RETURNING id INTO new_game_id;
    
    -- Adiciona os 4 jogadores ao jogo
    pos := 1;
    FOREACH user_id IN ARRAY queue_users LOOP
        INSERT INTO game_players (game_id, user_id, position) 
        VALUES (new_game_id, user_id, pos);
        pos := pos + 1;
    END LOOP;
    
    -- Atualiza o status dos jogadores de 'searching' para 'matched'
    UPDATE matchmaking_queue 
    SET status = 'matched', updated_at = NOW()
    WHERE user_id = ANY(queue_users) 
    AND idjogopleiteado = target_game_id;
    
    -- Inicia o jogo automaticamente
    UPDATE games 
    SET status = 'active', 
        current_player_turn = queue_users[1],
        turn_start_time = NOW()
    WHERE id = new_game_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'game_id', new_game_id,
        'target_game_id', target_game_id,
        'players_count', array_length(queue_users, 1)
    );
END;
$function$;
