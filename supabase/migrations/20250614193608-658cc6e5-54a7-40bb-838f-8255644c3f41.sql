
-- Corrigir a função create_game_when_ready com sintaxe PostgreSQL válida
CREATE OR REPLACE FUNCTION public.create_game_when_ready()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    target_game_id bigint;
    queue_users uuid[];
    new_game_id uuid;
    user_id uuid;
    pos integer;
    all_pieces jsonb;
    shuffled_pieces jsonb;
    player1_hand jsonb;
    player2_hand jsonb;
    player3_hand jsonb;
    player4_hand jsonb;
    starting_player_pos integer := 1;
    starting_piece jsonb;
    initial_board_state jsonb;
    highest_value integer := -1;
    current_value integer;
    current_piece jsonb;
    temp_hand jsonb;
BEGIN
    RAISE NOTICE 'Iniciando create_game_when_ready...';
    
    -- Encontra um jogo que tenha pelo menos 4 jogadores esperando
    SELECT idjogopleiteado INTO target_game_id
    FROM matchmaking_queue 
    WHERE status = 'searching' 
    GROUP BY idjogopleiteado 
    HAVING COUNT(*) >= 4 
    LIMIT 1;
    
    -- Se não há jogo com 4+ jogadores, retorna erro
    IF target_game_id IS NULL THEN
        RAISE NOTICE 'Não há jogadores suficientes na fila';
        RETURN jsonb_build_object('success', false, 'error', 'Not enough players for any game');
    END IF;
    
    RAISE NOTICE 'Encontrado jogo pleiteado: %', target_game_id;
    
    -- Pega exatamente 4 jogadores do mesmo jogo (ordenados por created_at)
    SELECT ARRAY(
        SELECT user_id 
        FROM matchmaking_queue 
        WHERE status = 'searching' 
        AND idjogopleiteado = target_game_id
        ORDER BY created_at 
        LIMIT 4
    ) INTO queue_users;
    
    RAISE NOTICE 'Jogadores selecionados: %', queue_users;
    
    -- Gerar todas as peças de dominó como array JSON
    SELECT jsonb_agg(jsonb_build_object('l', i, 'r', j)) INTO all_pieces
    FROM (
        SELECT i, j 
        FROM generate_series(0, 6) i, generate_series(0, 6) j 
        WHERE i <= j
        ORDER BY random()
    ) pieces;
    
    RAISE NOTICE 'Peças embaralhadas geradas: % total', jsonb_array_length(all_pieces);
    
    -- Distribuir 6 peças para cada jogador usando slicing manual
    SELECT jsonb_agg(piece) INTO player1_hand
    FROM (
        SELECT jsonb_array_elements(all_pieces) as piece
        LIMIT 6
    ) p1;
    
    SELECT jsonb_agg(piece) INTO player2_hand
    FROM (
        SELECT jsonb_array_elements(all_pieces) as piece
        OFFSET 6 LIMIT 6
    ) p2;
    
    SELECT jsonb_agg(piece) INTO player3_hand
    FROM (
        SELECT jsonb_array_elements(all_pieces) as piece
        OFFSET 12 LIMIT 6
    ) p3;
    
    SELECT jsonb_agg(piece) INTO player4_hand
    FROM (
        SELECT jsonb_array_elements(all_pieces) as piece
        OFFSET 18 LIMIT 6
    ) p4;
    
    -- Determinar jogador inicial e peça inicial (maior carroça ou maior soma)
    -- Verificar jogador 1
    FOR i IN 0..5 LOOP
        current_piece := player1_hand->i;
        IF (current_piece->>'l')::int = (current_piece->>'r')::int THEN
            current_value := 100 + (current_piece->>'l')::int; -- Prioridade para carroças
        ELSE
            current_value := (current_piece->>'l')::int + (current_piece->>'r')::int;
        END IF;
        
        IF current_value > highest_value THEN
            highest_value := current_value;
            starting_piece := current_piece;
            starting_player_pos := 1;
        END IF;
    END LOOP;
    
    -- Verificar jogador 2
    FOR i IN 0..5 LOOP
        current_piece := player2_hand->i;
        IF (current_piece->>'l')::int = (current_piece->>'r')::int THEN
            current_value := 100 + (current_piece->>'l')::int;
        ELSE
            current_value := (current_piece->>'l')::int + (current_piece->>'r')::int;
        END IF;
        
        IF current_value > highest_value THEN
            highest_value := current_value;
            starting_piece := current_piece;
            starting_player_pos := 2;
        END IF;
    END LOOP;
    
    -- Verificar jogador 3
    FOR i IN 0..5 LOOP
        current_piece := player3_hand->i;
        IF (current_piece->>'l')::int = (current_piece->>'r')::int THEN
            current_value := 100 + (current_piece->>'l')::int;
        ELSE
            current_value := (current_piece->>'l')::int + (current_piece->>'r')::int;
        END IF;
        
        IF current_value > highest_value THEN
            highest_value := current_value;
            starting_piece := current_piece;
            starting_player_pos := 3;
        END IF;
    END LOOP;
    
    -- Verificar jogador 4
    FOR i IN 0..5 LOOP
        current_piece := player4_hand->i;
        IF (current_piece->>'l')::int = (current_piece->>'r')::int THEN
            current_value := 100 + (current_piece->>'l')::int;
        ELSE
            current_value := (current_piece->>'l')::int + (current_piece->>'r')::int;
        END IF;
        
        IF current_value > highest_value THEN
            highest_value := current_value;
            starting_piece := current_piece;
            starting_player_pos := 4;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Jogador inicial: % com peça: %', starting_player_pos, starting_piece;
    
    -- Remover peça inicial da mão do jogador inicial
    IF starting_player_pos = 1 THEN
        SELECT jsonb_agg(elem) INTO temp_hand
        FROM jsonb_array_elements(player1_hand) AS elem
        WHERE elem != starting_piece;
        player1_hand := temp_hand;
    ELSIF starting_player_pos = 2 THEN
        SELECT jsonb_agg(elem) INTO temp_hand
        FROM jsonb_array_elements(player2_hand) AS elem
        WHERE elem != starting_piece;
        player2_hand := temp_hand;
    ELSIF starting_player_pos = 3 THEN
        SELECT jsonb_agg(elem) INTO temp_hand
        FROM jsonb_array_elements(player3_hand) AS elem
        WHERE elem != starting_piece;
        player3_hand := temp_hand;
    ELSE
        SELECT jsonb_agg(elem) INTO temp_hand
        FROM jsonb_array_elements(player4_hand) AS elem
        WHERE elem != starting_piece;
        player4_hand := temp_hand;
    END IF;
    
    -- Montar estado inicial do tabuleiro
    initial_board_state := jsonb_build_object(
        'pieces', jsonb_build_array(starting_piece),
        'left_end', (starting_piece->>'l')::integer,
        'right_end', (starting_piece->>'r')::integer
    );
    
    -- Cria novo jogo
    INSERT INTO games (status, prize_pool, entry_fee, board_state, current_player_turn, turn_start_time) 
    VALUES ('active', 4.0, 1.10, initial_board_state, queue_users[starting_player_pos], NOW()) 
    RETURNING id INTO new_game_id;
    
    RAISE NOTICE 'Jogo criado com ID: %', new_game_id;
    
    -- Adiciona os 4 jogadores ao jogo com suas mãos
    INSERT INTO game_players (game_id, user_id, position, hand) 
    VALUES (new_game_id, queue_users[1], 1, player1_hand);
    
    INSERT INTO game_players (game_id, user_id, position, hand) 
    VALUES (new_game_id, queue_users[2], 2, player2_hand);
    
    INSERT INTO game_players (game_id, user_id, position, hand) 
    VALUES (new_game_id, queue_users[3], 3, player3_hand);
    
    INSERT INTO game_players (game_id, user_id, position, hand) 
    VALUES (new_game_id, queue_users[4], 4, player4_hand);
    
    RAISE NOTICE 'Todos os jogadores adicionados ao jogo';
    
    -- Atualiza o status dos jogadores de 'searching' para 'matched'
    UPDATE matchmaking_queue 
    SET status = 'matched', updated_at = NOW()
    WHERE user_id = ANY(queue_users) 
    AND idjogopleiteado = target_game_id;
    
    RAISE NOTICE 'Jogo criado e iniciado automaticamente: %', new_game_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'game_id', new_game_id,
        'target_game_id', target_game_id,
        'players_count', array_length(queue_users, 1),
        'starting_player', queue_users[starting_player_pos],
        'starting_piece', starting_piece
    );
END;
$function$;

-- Recriar o trigger para auto-criação de jogos
DROP TRIGGER IF EXISTS trigger_auto_create_game ON matchmaking_queue;

CREATE OR REPLACE FUNCTION auto_create_game_on_queue_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    queue_count integer;
    result jsonb;
BEGIN
    RAISE NOTICE 'Trigger acionado para mudança na fila. Event: %, User: %', TG_OP, COALESCE(NEW.user_id, OLD.user_id);
    
    -- Contar quantos jogadores estão na fila para dominó (idjogopleiteado = 1)
    SELECT COUNT(*) INTO queue_count
    FROM matchmaking_queue 
    WHERE status = 'searching' AND idjogopleiteado = 1;
    
    RAISE NOTICE 'Jogadores na fila: %', queue_count;
    
    -- Se há 4 ou mais jogadores, tentar criar um jogo
    IF queue_count >= 4 THEN
        RAISE NOTICE 'Tentando criar jogo automaticamente...';
        -- Chamar a função existente para criar o jogo
        SELECT create_game_when_ready() INTO result;
        
        -- Log do resultado para debug
        RAISE NOTICE 'Resultado da auto-criação de jogo: %', result;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar trigger que executa após INSERT ou UPDATE na matchmaking_queue
CREATE TRIGGER trigger_auto_create_game
    AFTER INSERT OR UPDATE ON matchmaking_queue
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_game_on_queue_change();

-- Garantir que realtime está habilitado para games
ALTER TABLE games REPLICA IDENTITY FULL;

-- Garantir que realtime está habilitado para game_players  
ALTER TABLE game_players REPLICA IDENTITY FULL;
