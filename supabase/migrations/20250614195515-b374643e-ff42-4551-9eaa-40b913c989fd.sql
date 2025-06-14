
-- Corrigir a função create_game_when_ready com melhor distribuição de peças e logs detalhados
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
    hand_sizes integer[] := ARRAY[0,0,0,0];
    final_check_count integer;
    final_board_valid boolean;
    final_pieces_count integer;
    final_hands_valid boolean := true;
    hand_check jsonb;
BEGIN
    RAISE NOTICE '🎮 === INICIANDO create_game_when_ready v2.0 ===';
    
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
    RAISE NOTICE '📊 Número de jogadores: %', array_length(queue_users, 1);
    
    -- Gerar todas as 28 peças de dominó CORRETAMENTE
    all_pieces := '[]'::jsonb;
    piece_count := 0;
    
    FOR i IN 0..6 LOOP
        FOR j IN i..6 LOOP
            all_pieces := all_pieces || jsonb_build_array(jsonb_build_object('l', i, 'r', j));
            piece_count := piece_count + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '🎲 Peças geradas: % peças', piece_count;
    
    -- Embaralhar as peças de forma mais robusta
    WITH shuffled_pieces AS (
        SELECT piece, ROW_NUMBER() OVER (ORDER BY random()) as rn
        FROM jsonb_array_elements(all_pieces) AS piece
    )
    SELECT jsonb_agg(piece ORDER BY rn) INTO all_pieces FROM shuffled_pieces;
    
    piece_count := jsonb_array_length(all_pieces);
    RAISE NOTICE '🔀 Peças embaralhadas: % total', piece_count;
    
    -- Verificar se temos exatamente 28 peças
    IF piece_count != 28 THEN
        RAISE EXCEPTION 'ERRO CRÍTICO: Número incorreto de peças geradas: %. Esperado: 28', piece_count;
    END IF;
    
    -- Distribuir peças usando método mais seguro e com logs detalhados
    -- Player 1: peças 0-5
    SELECT jsonb_agg(all_pieces->i) INTO player1_hand 
    FROM generate_series(0, 5) AS i;
    hand_sizes[1] := jsonb_array_length(player1_hand);
    
    -- Player 2: peças 6-11
    SELECT jsonb_agg(all_pieces->i) INTO player2_hand 
    FROM generate_series(6, 11) AS i;
    hand_sizes[2] := jsonb_array_length(player2_hand);
    
    -- Player 3: peças 12-17
    SELECT jsonb_agg(all_pieces->i) INTO player3_hand 
    FROM generate_series(12, 17) AS i;
    hand_sizes[3] := jsonb_array_length(player3_hand);
    
    -- Player 4: peças 18-23
    SELECT jsonb_agg(all_pieces->i) INTO player4_hand 
    FROM generate_series(18, 23) AS i;
    hand_sizes[4] := jsonb_array_length(player4_hand);
    
    RAISE NOTICE '🃏 Mãos distribuídas - P1: %, P2: %, P3: %, P4: %', 
        hand_sizes[1], hand_sizes[2], hand_sizes[3], hand_sizes[4];
    
    -- Verificar se todas as mãos têm 6 peças
    FOR i IN 1..4 LOOP
        IF hand_sizes[i] != 6 THEN
            RAISE EXCEPTION 'ERRO: Jogador % recebeu % peças, esperado: 6', i, hand_sizes[i];
        END IF;
    END LOOP;
    
    -- Determinar jogador inicial e peça inicial com logs detalhados
    RAISE NOTICE '🏆 Determinando jogador inicial...';
    
    FOR piece_index IN 0..5 LOOP
        -- Player 1
        current_piece := player1_hand->piece_index;
        IF (current_piece->>'l')::int = (current_piece->>'r')::int THEN
            current_value := 100 + (current_piece->>'l')::int; -- Prioridade carroças
        ELSE
            current_value := (current_piece->>'l')::int + (current_piece->>'r')::int;
        END IF;
        
        RAISE NOTICE '   P1[%]: [%|%] = %', piece_index, current_piece->>'l', current_piece->>'r', current_value;
        
        IF current_value > highest_value THEN
            highest_value := current_value;
            starting_piece := current_piece;
            starting_player_pos := 1;
            RAISE NOTICE '   *** NOVA MELHOR PEÇA: P1 [%|%] = %', current_piece->>'l', current_piece->>'r', current_value;
        END IF;
        
        -- Player 2
        current_piece := player2_hand->piece_index;
        IF (current_piece->>'l')::int = (current_piece->>'r')::int THEN
            current_value := 100 + (current_piece->>'l')::int;
        ELSE
            current_value := (current_piece->>'l')::int + (current_piece->>'r')::int;
        END IF;
        
        RAISE NOTICE '   P2[%]: [%|%] = %', piece_index, current_piece->>'l', current_piece->>'r', current_value;
        
        IF current_value > highest_value THEN
            highest_value := current_value;
            starting_piece := current_piece;
            starting_player_pos := 2;
            RAISE NOTICE '   *** NOVA MELHOR PEÇA: P2 [%|%] = %', current_piece->>'l', current_piece->>'r', current_value;
        END IF;
        
        -- Player 3
        current_piece := player3_hand->piece_index;
        IF (current_piece->>'l')::int = (current_piece->>'r')::int THEN
            current_value := 100 + (current_piece->>'l')::int;
        ELSE
            current_value := (current_piece->>'l')::int + (current_piece->>'r')::int;
        END IF;
        
        RAISE NOTICE '   P3[%]: [%|%] = %', piece_index, current_piece->>'l', current_piece->>'r', current_value;
        
        IF current_value > highest_value THEN
            highest_value := current_value;
            starting_piece := current_piece;
            starting_player_pos := 3;
            RAISE NOTICE '   *** NOVA MELHOR PEÇA: P3 [%|%] = %', current_piece->>'l', current_piece->>'r', current_value;
        END IF;
        
        -- Player 4
        current_piece := player4_hand->piece_index;
        IF (current_piece->>'l')::int = (current_piece->>'r')::int THEN
            current_value := 100 + (current_piece->>'l')::int;
        ELSE
            current_value := (current_piece->>'l')::int + (current_piece->>'r')::int;
        END IF;
        
        RAISE NOTICE '   P4[%]: [%|%] = %', piece_index, current_piece->>'l', current_piece->>'r', current_value;
        
        IF current_value > highest_value THEN
            highest_value := current_value;
            starting_piece := current_piece;
            starting_player_pos := 4;
            RAISE NOTICE '   *** NOVA MELHOR PEÇA: P4 [%|%] = %', current_piece->>'l', current_piece->>'r', current_value;
        END IF;
    END LOOP;
    
    RAISE NOTICE '🏆 RESULTADO: Jogador % com peça [%|%] (valor: %)', 
        starting_player_pos, starting_piece->>'l', starting_piece->>'r', highest_value;
    
    -- Verificar se encontramos uma peça válida
    IF starting_piece IS NULL THEN
        RAISE EXCEPTION 'ERRO: Não foi possível determinar peça inicial';
    END IF;
    
    -- Remover peça inicial da mão do jogador correspondente
    RAISE NOTICE '🗑️ Removendo peça inicial da mão do jogador %...', starting_player_pos;
    
    IF starting_player_pos = 1 THEN
        SELECT jsonb_agg(elem) INTO temp_hand
        FROM jsonb_array_elements(player1_hand) AS elem
        WHERE elem != starting_piece;
        player1_hand := COALESCE(temp_hand, '[]'::jsonb);
        RAISE NOTICE '   P1 agora tem % peças', jsonb_array_length(player1_hand);
    ELSIF starting_player_pos = 2 THEN
        SELECT jsonb_agg(elem) INTO temp_hand
        FROM jsonb_array_elements(player2_hand) AS elem
        WHERE elem != starting_piece;
        player2_hand := COALESCE(temp_hand, '[]'::jsonb);
        RAISE NOTICE '   P2 agora tem % peças', jsonb_array_length(player2_hand);
    ELSIF starting_player_pos = 3 THEN
        SELECT jsonb_agg(elem) INTO temp_hand
        FROM jsonb_array_elements(player3_hand) AS elem
        WHERE elem != starting_piece;
        player3_hand := COALESCE(temp_hand, '[]'::jsonb);
        RAISE NOTICE '   P3 agora tem % peças', jsonb_array_length(player3_hand);
    ELSE
        SELECT jsonb_agg(elem) INTO temp_hand
        FROM jsonb_array_elements(player4_hand) AS elem
        WHERE elem != starting_piece;
        player4_hand := COALESCE(temp_hand, '[]'::jsonb);
        RAISE NOTICE '   P4 agora tem % peças', jsonb_array_length(player4_hand);
    END IF;
    
    -- Criar estado inicial do tabuleiro CORRETO
    initial_board_state := jsonb_build_object(
        'pieces', jsonb_build_array(starting_piece),
        'left_end', (starting_piece->>'l')::integer,
        'right_end', (starting_piece->>'r')::integer
    );
    
    RAISE NOTICE '🎯 Estado inicial do tabuleiro: %', initial_board_state;
    
    -- Criar o jogo no banco
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
    
    RAISE NOTICE '👥 Todos os 4 jogadores adicionados ao jogo';
    
    -- Marcar jogadores como matched
    UPDATE matchmaking_queue 
    SET status = 'matched', updated_at = NOW()
    WHERE user_id = ANY(queue_users) 
    AND idjogopleiteado = target_game_id;
    
    RAISE NOTICE '✅ Status da fila atualizado para matched';
    
    -- Verificação final DETALHADA
    SELECT COUNT(*) INTO final_check_count FROM game_players WHERE game_id = new_game_id;
    
    final_board_valid := (initial_board_state ? 'pieces') AND 
                       (jsonb_array_length(initial_board_state->'pieces') > 0) AND
                       (initial_board_state ? 'left_end') AND
                       (initial_board_state ? 'right_end');
    
    final_pieces_count := jsonb_array_length(initial_board_state->'pieces');
    
    -- Verificar mãos dos jogadores
    FOR i IN 1..4 LOOP
        SELECT hand INTO hand_check FROM game_players 
        WHERE game_id = new_game_id AND position = i;
        
        IF hand_check IS NULL OR jsonb_array_length(hand_check) != 5 THEN
            final_hands_valid := false;
            RAISE NOTICE '❌ Jogador % tem mão inválida: %', i, hand_check;
        ELSE
            RAISE NOTICE '✅ Jogador % tem mão válida com % peças', i, jsonb_array_length(hand_check);
        END IF;
    END LOOP;
    
    RAISE NOTICE '🔍 === VERIFICAÇÃO FINAL ===';
    RAISE NOTICE '   Jogadores: % (esperado: 4)', final_check_count;
    RAISE NOTICE '   Tabuleiro válido: %', final_board_valid;
    RAISE NOTICE '   Peças no tabuleiro: %', final_pieces_count;
    RAISE NOTICE '   Mãos válidas: %', final_hands_valid;
    RAISE NOTICE '   Turno atual: %', queue_users[starting_player_pos];
    
    IF final_check_count != 4 OR NOT final_board_valid OR NOT final_hands_valid THEN
        RAISE EXCEPTION 'FALHA na verificação final do jogo - Players: %, Board: %, Hands: %', 
            final_check_count, final_board_valid, final_hands_valid;
    END IF;
    
    RAISE NOTICE '🎉 === JOGO CRIADO COM SUCESSO ===';
    RAISE NOTICE '   Game ID: %', new_game_id;
    RAISE NOTICE '   Jogadores: %', queue_users;
    RAISE NOTICE '   Jogador inicial: % (posição %)', queue_users[starting_player_pos], starting_player_pos;
    RAISE NOTICE '   Peça inicial: [%|%]', starting_piece->>'l', starting_piece->>'r';
    
    RETURN jsonb_build_object(
        'success', true, 
        'game_id', new_game_id,
        'target_game_id', target_game_id,
        'players_count', 4,
        'starting_player', queue_users[starting_player_pos],
        'starting_piece', starting_piece,
        'board_state', initial_board_state,
        'debug_info', jsonb_build_object(
            'hand_sizes', hand_sizes,
            'highest_piece_value', highest_value,
            'total_pieces_distributed', 25
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ === ERRO GERAL NA CRIAÇÃO DO JOGO ===';
        RAISE NOTICE '   Erro: %', SQLERRM;
        RAISE NOTICE '   Game ID: %', new_game_id;
        
        -- Limpar dados parciais se algo der errado
        IF new_game_id IS NOT NULL THEN
            RAISE NOTICE '🧹 Limpando dados parciais...';
            DELETE FROM game_players WHERE game_id = new_game_id;
            DELETE FROM games WHERE id = new_game_id;
            RAISE NOTICE '✅ Limpeza concluída';
        END IF;
        
        RETURN jsonb_build_object(
            'success', false, 
            'error', SQLERRM,
            'debug_info', jsonb_build_object(
                'target_game_id', target_game_id,
                'queue_users', queue_users,
                'piece_count', piece_count
            )
        );
END;
$function$;

-- Função para limpeza automática de jogos malformados
CREATE OR REPLACE FUNCTION public.cleanup_malformed_games()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    cleanup_count integer := 0;
    malformed_game record;
BEGIN
    RAISE NOTICE '🧹 Iniciando limpeza de jogos malformados...';
    
    -- Encontrar e deletar jogos malformados (sem board_state válido ou sem jogadores)
    FOR malformed_game IN
        SELECT g.id, g.created_at, 
               (SELECT COUNT(*) FROM game_players gp WHERE gp.game_id = g.id) as player_count
        FROM games g
        WHERE g.status = 'active' 
        AND (
            g.board_state IS NULL 
            OR NOT (g.board_state ? 'pieces')
            OR jsonb_array_length(g.board_state->'pieces') = 0
            OR NOT (g.board_state ? 'left_end')
            OR NOT (g.board_state ? 'right_end')
            OR g.created_at < NOW() - INTERVAL '10 minutes'
        )
    LOOP
        RAISE NOTICE '🗑️ Removendo jogo malformado: % (criado: %, jogadores: %)', 
            malformed_game.id, malformed_game.created_at, malformed_game.player_count;
        
        -- Deletar jogadores primeiro (FK constraint)
        DELETE FROM game_players WHERE game_id = malformed_game.id;
        
        -- Deletar o jogo
        DELETE FROM games WHERE id = malformed_game.id;
        
        cleanup_count := cleanup_count + 1;
    END LOOP;
    
    RAISE NOTICE '✅ Limpeza concluída: % jogos removidos', cleanup_count;
    
    RETURN jsonb_build_object(
        'success', true,
        'cleaned_games', cleanup_count
    );
END;
$function$;

-- Trigger para executar limpeza automática periodicamente
CREATE OR REPLACE FUNCTION public.auto_cleanup_on_game_creation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- A cada 5 criações de jogo, executar limpeza
    IF (SELECT COUNT(*) FROM games WHERE created_at > NOW() - INTERVAL '1 hour') % 5 = 0 THEN
        PERFORM cleanup_malformed_games();
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Criar trigger para limpeza automática
DROP TRIGGER IF EXISTS trigger_auto_cleanup ON games;
CREATE TRIGGER trigger_auto_cleanup
    AFTER INSERT ON games
    FOR EACH ROW
    EXECUTE FUNCTION auto_cleanup_on_game_creation();
