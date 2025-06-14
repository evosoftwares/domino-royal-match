
-- Corrigir a função create_game_when_ready com distribuição mais robusta
CREATE OR REPLACE FUNCTION public.create_game_when_ready()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    target_game_id bigint;
    queue_users uuid[];
    new_game_id uuid;
    all_pieces jsonb;
    piece_count integer;
    player1_hand jsonb;
    player2_hand jsonb;
    player3_hand jsonb;
    player4_hand jsonb;
    starting_player_pos integer := 1;
    starting_piece jsonb;
    initial_board_state jsonb;
    highest_value integer := -1;
    current_value integer;
    temp_hand jsonb;
    i integer;
    j integer;
    piece_index integer;
    current_piece jsonb;
BEGIN
    RAISE NOTICE '🎮 Iniciando create_game_when_ready...';
    
    -- Encontra um jogo que tenha pelo menos 4 jogadores esperando
    SELECT idjogopleiteado INTO target_game_id
    FROM matchmaking_queue 
    WHERE status = 'searching' 
    GROUP BY idjogopleiteado 
    HAVING COUNT(*) >= 4 
    LIMIT 1;
    
    IF target_game_id IS NULL THEN
        RAISE NOTICE '❌ Não há jogadores suficientes na fila';
        RETURN jsonb_build_object('success', false, 'error', 'Not enough players for any game');
    END IF;
    
    RAISE NOTICE '✅ Encontrado jogo pleiteado: %', target_game_id;
    
    -- Pega exatamente 4 jogadores do mesmo jogo
    SELECT ARRAY(
        SELECT user_id 
        FROM matchmaking_queue 
        WHERE status = 'searching' 
        AND idjogopleiteado = target_game_id
        ORDER BY created_at 
        LIMIT 4
    ) INTO queue_users;
    
    RAISE NOTICE '👥 Jogadores selecionados: %', queue_users;
    
    -- Gerar todas as 28 peças de dominó de forma mais sistemática
    all_pieces := '[]'::jsonb;
    FOR i IN 0..6 LOOP
        FOR j IN i..6 LOOP
            all_pieces := all_pieces || jsonb_build_array(jsonb_build_object('l', i, 'r', j));
        END LOOP;
    END LOOP;
    
    -- Embaralhar usando ORDER BY random() de forma mais controlada
    WITH shuffled_pieces AS (
        SELECT piece, ROW_NUMBER() OVER (ORDER BY random()) as rn
        FROM jsonb_array_elements(all_pieces) AS piece
    )
    SELECT jsonb_agg(piece ORDER BY rn) INTO all_pieces FROM shuffled_pieces;
    
    piece_count := jsonb_array_length(all_pieces);
    RAISE NOTICE '🎲 Peças geradas e embaralhadas: % total', piece_count;
    
    -- Verificar se temos exatamente 28 peças
    IF piece_count != 28 THEN
        RAISE EXCEPTION 'Erro crítico: Número incorreto de peças geradas: %', piece_count;
    END IF;
    
    -- Distribuir exatamente 6 peças para cada jogador de forma mais segura
    SELECT jsonb_agg(all_pieces->i) INTO player1_hand FROM generate_series(0, 5) AS i;
    SELECT jsonb_agg(all_pieces->i) INTO player2_hand FROM generate_series(6, 11) AS i;
    SELECT jsonb_agg(all_pieces->i) INTO player3_hand FROM generate_series(12, 17) AS i;
    SELECT jsonb_agg(all_pieces->i) INTO player4_hand FROM generate_series(18, 23) AS i;
    
    RAISE NOTICE '🃏 Mãos distribuídas - P1: %, P2: %, P3: %, P4: %', 
        jsonb_array_length(player1_hand), 
        jsonb_array_length(player2_hand),
        jsonb_array_length(player3_hand), 
        jsonb_array_length(player4_hand);
    
    -- Determinar jogador inicial (maior carroça ou maior soma)
    -- Verificar todas as mãos para encontrar a melhor peça
    FOR piece_index IN 0..5 LOOP
        -- Player 1
        current_piece := player1_hand->piece_index;
        IF (current_piece->>'l')::int = (current_piece->>'r')::int THEN
            current_value := 100 + (current_piece->>'l')::int; -- Prioridade carroças
        ELSE
            current_value := (current_piece->>'l')::int + (current_piece->>'r')::int;
        END IF;
        IF current_value > highest_value THEN
            highest_value := current_value;
            starting_piece := current_piece;
            starting_player_pos := 1;
        END IF;
        
        -- Player 2
        current_piece := player2_hand->piece_index;
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
        
        -- Player 3
        current_piece := player3_hand->piece_index;
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
        
        -- Player 4
        current_piece := player4_hand->piece_index;
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
    
    RAISE NOTICE '🏆 Jogador inicial: % com peça: % (valor: %)', starting_player_pos, starting_piece, highest_value;
    
    -- Remover peça inicial da mão do jogador correspondente
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
    
    -- Criar estado inicial do tabuleiro com a peça inicial
    initial_board_state := jsonb_build_object(
        'pieces', jsonb_build_array(starting_piece),
        'left_end', (starting_piece->>'l')::integer,
        'right_end', (starting_piece->>'r')::integer
    );
    
    RAISE NOTICE '🎯 Estado inicial do tabuleiro criado: %', initial_board_state;
    
    -- Criar o jogo
    INSERT INTO games (status, prize_pool, entry_fee, board_state, current_player_turn, turn_start_time, consecutive_passes) 
    VALUES ('active', 4.0, 1.10, initial_board_state, queue_users[starting_player_pos], NOW(), 0) 
    RETURNING id INTO new_game_id;
    
    RAISE NOTICE '🎮 Jogo criado com ID: %', new_game_id;
    
    -- Adicionar todos os jogadores com suas mãos
    INSERT INTO game_players (game_id, user_id, position, hand) VALUES 
    (new_game_id, queue_users[1], 1, COALESCE(player1_hand, '[]'::jsonb)),
    (new_game_id, queue_users[2], 2, COALESCE(player2_hand, '[]'::jsonb)),
    (new_game_id, queue_users[3], 3, COALESCE(player3_hand, '[]'::jsonb)),
    (new_game_id, queue_users[4], 4, COALESCE(player4_hand, '[]'::jsonb));
    
    RAISE NOTICE '👥 Todos os jogadores adicionados ao jogo';
    
    -- Marcar jogadores como matched
    UPDATE matchmaking_queue 
    SET status = 'matched', updated_at = NOW()
    WHERE user_id = ANY(queue_users) 
    AND idjogopleiteado = target_game_id;
    
    RAISE NOTICE '✅ Jogo criado e iniciado com sucesso: %', new_game_id;
    
    -- Verificação final
    DECLARE
        final_check_count integer;
        final_board_valid boolean;
    BEGIN
        SELECT COUNT(*) INTO final_check_count FROM game_players WHERE game_id = new_game_id;
        final_board_valid := (initial_board_state ? 'pieces') AND (jsonb_array_length(initial_board_state->'pieces') > 0);
        
        RAISE NOTICE '🔍 Verificação final - Jogadores: %, Tabuleiro válido: %', final_check_count, final_board_valid;
        
        IF final_check_count != 4 OR NOT final_board_valid THEN
            RAISE EXCEPTION 'Falha na verificação final do jogo criado';
        END IF;
    END;
    
    RETURN jsonb_build_object(
        'success', true, 
        'game_id', new_game_id,
        'target_game_id', target_game_id,
        'players_count', 4,
        'starting_player', queue_users[starting_player_pos],
        'starting_piece', starting_piece,
        'board_state', initial_board_state
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro na criação do jogo: %', SQLERRM;
        -- Limpar dados parciais se algo der errado
        IF new_game_id IS NOT NULL THEN
            DELETE FROM game_players WHERE game_id = new_game_id;
            DELETE FROM games WHERE id = new_game_id;
        END IF;
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
