
-- Atualiza a função create_game_when_ready para considerar o idJogoPleiteado
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
    SELECT idJogoPleiteado INTO target_game_id
    FROM matchmaking_queue 
    WHERE status = 'searching' 
    GROUP BY idJogoPleiteado 
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
        AND mq.idJogoPleiteado = target_game_id
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
    AND idJogoPleiteado = target_game_id;
    
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

-- Também vamos ajustar a função join_matchmaking_queue para garantir que funcione corretamente
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

    -- 3. Para este jogo de dominó, vamos usar um idJogoPleiteado fixo (1)
    --    Você pode modificar isso depois para permitir diferentes tipos de jogo
    v_id_jogo_pleiteado := 1;

    -- 4. Insere ou atualiza o registro do usuário na fila
    INSERT INTO matchmaking_queue (user_id, status, idJogoPleiteado)
    VALUES (current_user_id, 'searching', v_id_jogo_pleiteado)
    ON CONFLICT (user_id) DO UPDATE SET
        status = 'searching',
        idJogoPleiteado = v_id_jogo_pleiteado,
        updated_at = NOW();

    -- 5. Contar quantos usuários estão agora procurando pelo mesmo jogo
    SELECT COUNT(*) INTO queue_count
    FROM matchmaking_queue
    WHERE status = 'searching' AND idJogoPleiteado = v_id_jogo_pleiteado;

    -- 6. Retornar sucesso com a contagem de jogadores para aquele jogo específico
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Entrou na fila com sucesso',
        'idJogoPleiteado', v_id_jogo_pleiteado,
        'queue_count', queue_count
    );

END;
$function$;
