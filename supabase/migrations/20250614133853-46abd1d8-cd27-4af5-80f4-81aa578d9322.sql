
-- Corrigir ambiguidade de user_id nas funções
CREATE OR REPLACE FUNCTION public.join_matchmaking_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
    v_id_jogo_pleiteado integer;
    queue_count integer;
BEGIN
    -- 1. Obter o ID do usuário da sessão atual
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário não autenticado');
    END IF;

    -- 2. Verificar se o usuário já está na fila com status 'searching'
    IF EXISTS (SELECT 1 FROM matchmaking_queue WHERE matchmaking_queue.user_id = current_user_id AND matchmaking_queue.status = 'searching') THEN
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
    WHERE matchmaking_queue.status = 'searching' AND matchmaking_queue.idjogopleiteado = v_id_jogo_pleiteado;

    -- 6. Retornar sucesso com a contagem de jogadores para aquele jogo específico
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Entrou na fila com sucesso',
        'idjogopleiteado', v_id_jogo_pleiteado,
        'queue_count', queue_count
    );

END;
$$;

-- Corrigir a função create_game_when_ready
CREATE OR REPLACE FUNCTION public.create_game_when_ready()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    target_game_id bigint;
    queue_users uuid[];
    new_game_id uuid;
    user_id uuid;
    pos integer;
BEGIN
    -- Encontra um jogo que tenha pelo menos 4 jogadores esperando
    SELECT mq.idjogopleiteado INTO target_game_id
    FROM matchmaking_queue mq 
    WHERE mq.status = 'searching' 
    GROUP BY mq.idjogopleiteado 
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
    WHERE matchmaking_queue.user_id = ANY(queue_users) 
    AND matchmaking_queue.idjogopleiteado = target_game_id;
    
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
$$;

-- Corrigir a função leave_matchmaking_queue também
CREATE OR REPLACE FUNCTION public.leave_matchmaking_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
BEGIN
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
    END IF;
    
    DELETE FROM matchmaking_queue WHERE matchmaking_queue.user_id = current_user_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Removed from queue');
END;
$$;

-- Corrigir o trigger também
CREATE OR REPLACE FUNCTION auto_create_game_on_queue_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    queue_count integer;
    result jsonb;
BEGIN
    -- Contar quantos jogadores estão na fila para dominó (idjogopleiteado = 1)
    SELECT COUNT(*) INTO queue_count
    FROM matchmaking_queue mq
    WHERE mq.status = 'searching' AND mq.idjogopleiteado = 1;
    
    -- Se há 4 ou mais jogadores, tentar criar um jogo
    IF queue_count >= 4 THEN
        -- Chamar a função existente para criar o jogo
        SELECT create_game_when_ready() INTO result;
        
        -- Log do resultado para debug
        RAISE NOTICE 'Auto-criação de jogo: %', result;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;
