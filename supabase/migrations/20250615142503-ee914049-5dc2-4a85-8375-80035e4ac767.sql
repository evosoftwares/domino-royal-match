
-- Função para verificar se um jogador está online baseado na última atividade
CREATE OR REPLACE FUNCTION is_player_online(player_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Considera online se última atividade foi há menos de 30 segundos
    RETURN EXISTS (
        SELECT 1 FROM player_presence 
        WHERE user_id = player_user_id 
        AND last_seen > NOW() - INTERVAL '30 seconds'
        AND status = 'online'
    );
END;
$$ LANGUAGE plpgsql;

-- Função para executar jogada automática para jogador offline
CREATE OR REPLACE FUNCTION auto_play_for_offline_player(game_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
    game_record RECORD;
    current_player RECORD;
    player_hand JSONB;
    piece_to_play JSONB;
    board_ends JSONB;
    new_board_state JSONB;
    next_player_id UUID;
    players_in_game UUID[];
    current_position INTEGER;
    next_position INTEGER;
    total_players INTEGER;
BEGIN
    -- Buscar dados do jogo
    SELECT * INTO game_record FROM games 
    WHERE id = game_id_param AND status = 'active';
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Jogo não encontrado ou não ativo: %', game_id_param;
        RETURN FALSE;
    END IF;
    
    -- Buscar dados do jogador atual
    SELECT * INTO current_player FROM game_players 
    WHERE game_id = game_id_param AND user_id = game_record.current_player_turn;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Jogador atual não encontrado: %', game_record.current_player_turn;
        RETURN FALSE;
    END IF;
    
    -- Verificar se jogador está offline
    IF is_player_online(game_record.current_player_turn) THEN
        RAISE NOTICE 'Jogador % está online, não executando jogada automática', game_record.current_player_turn;
        RETURN FALSE;
    END IF;
    
    RAISE NOTICE 'Executando jogada automática para jogador offline: %', game_record.current_player_turn;
    
    player_hand := current_player.hand;
    
    -- Extrair extremidades do tabuleiro
    board_ends := CASE 
        WHEN jsonb_array_length(game_record.board_state->'pieces') = 0 THEN 
            '{"left": null, "right": null}'::jsonb
        ELSE 
            jsonb_build_object(
                'left', (game_record.board_state->'pieces'->0->>'l')::integer,
                'right', (game_record.board_state->'pieces'->(jsonb_array_length(game_record.board_state->'pieces')-1)->>'r')::integer
            )
    END;
    
    -- Procurar primeira peça jogável
    piece_to_play := NULL;
    FOR i IN 0..(jsonb_array_length(player_hand) - 1) LOOP
        DECLARE
            piece JSONB := player_hand->i;
            piece_l INTEGER := (piece->>'l')::integer;
            piece_r INTEGER := (piece->>'r')::integer;
            left_end INTEGER := (board_ends->>'left')::integer;
            right_end INTEGER := (board_ends->>'right')::integer;
        BEGIN
            -- Verificar se peça pode conectar
            IF (board_ends->>'left' IS NULL) OR 
               (piece_l = left_end OR piece_r = left_end OR piece_l = right_end OR piece_r = right_end) THEN
                piece_to_play := piece;
                EXIT;
            END IF;
        END;
    END LOOP;
    
    -- Buscar próximo jogador
    SELECT array_agg(user_id ORDER BY position), 
           array_agg(position ORDER BY position) 
    INTO players_in_game 
    FROM game_players 
    WHERE game_id = game_id_param;
    
    total_players := array_length(players_in_game, 1);
    current_position := current_player.position;
    next_position := CASE WHEN current_position >= total_players THEN 1 ELSE current_position + 1 END;
    
    SELECT user_id INTO next_player_id 
    FROM game_players 
    WHERE game_id = game_id_param AND position = next_position;
    
    IF piece_to_play IS NOT NULL THEN
        -- Jogar a peça
        DECLARE
            piece_l INTEGER := (piece_to_play->>'l')::integer;
            piece_r INTEGER := (piece_to_play->>'r')::integer;
            left_end INTEGER := (board_ends->>'left')::integer;
            right_end INTEGER := (board_ends->>'right')::integer;
            new_pieces JSONB;
            updated_hand JSONB;
        BEGIN
            -- Determinar como conectar a peça
            IF board_ends->>'left' IS NULL THEN
                -- Primeira peça do jogo
                new_pieces := jsonb_build_array(piece_to_play);
            ELSIF piece_l = left_end THEN
                -- Conectar no lado esquerdo, virar peça
                new_pieces := jsonb_build_array(jsonb_build_object('l', piece_r, 'r', piece_l)) || (game_record.board_state->'pieces');
            ELSIF piece_r = left_end THEN
                -- Conectar no lado esquerdo, manter orientação
                new_pieces := jsonb_build_array(piece_to_play) || (game_record.board_state->'pieces');
            ELSIF piece_l = right_end THEN
                -- Conectar no lado direito, manter orientação
                new_pieces := (game_record.board_state->'pieces') || jsonb_build_array(piece_to_play);
            ELSE
                -- Conectar no lado direito, virar peça
                new_pieces := (game_record.board_state->'pieces') || jsonb_build_array(jsonb_build_object('l', piece_r, 'r', piece_l));
            END IF;
            
            new_board_state := jsonb_build_object('pieces', new_pieces);
            
            -- Remover peça da mão
            updated_hand := '[]'::jsonb;
            FOR i IN 0..(jsonb_array_length(player_hand) - 1) LOOP
                IF player_hand->i != piece_to_play THEN
                    updated_hand := updated_hand || jsonb_build_array(player_hand->i);
                END IF;
            END LOOP;
            
            -- Atualizar jogo
            UPDATE games SET 
                board_state = new_board_state,
                current_player_turn = next_player_id,
                consecutive_passes = 0,
                turn_start_time = NOW(),
                updated_at = NOW()
            WHERE id = game_id_param;
            
            -- Atualizar mão do jogador
            UPDATE game_players SET 
                hand = updated_hand,
                updated_at = NOW()
            WHERE id = current_player.id;
            
            RAISE NOTICE 'Jogada automática executada: peça [%|%] para jogador offline %', 
                piece_l, piece_r, game_record.current_player_turn;
            
            RETURN TRUE;
        END;
    ELSE
        -- Passar a vez
        UPDATE games SET 
            current_player_turn = next_player_id,
            consecutive_passes = COALESCE(consecutive_passes, 0) + 1,
            turn_start_time = NOW(),
            updated_at = NOW()
        WHERE id = game_id_param;
        
        RAISE NOTICE 'Jogador offline % passou a vez automaticamente', game_record.current_player_turn;
        
        RETURN TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger para monitorar jogadores offline e executar jogadas automáticas
CREATE OR REPLACE FUNCTION check_offline_players_trigger()
RETURNS TRIGGER AS $$
DECLARE
    time_since_turn_start INTERVAL;
BEGIN
    -- Verificar se o jogo está ativo e se passou tempo suficiente
    IF NEW.status = 'active' AND NEW.current_player_turn IS NOT NULL THEN
        time_since_turn_start := NOW() - NEW.turn_start_time;
        
        -- Se passou mais de 12 segundos, verificar se jogador está offline
        IF time_since_turn_start > INTERVAL '12 seconds' THEN
            -- Executar jogada automática se jogador estiver offline
            PERFORM auto_play_for_offline_player(NEW.id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para monitorar atualizações nos jogos
DROP TRIGGER IF EXISTS offline_player_check_trigger ON games;
CREATE TRIGGER offline_player_check_trigger
    AFTER UPDATE OF turn_start_time ON games
    FOR EACH ROW
    EXECUTE FUNCTION check_offline_players_trigger();

-- Função para limpeza periódica de jogos com jogadores offline
CREATE OR REPLACE FUNCTION cleanup_offline_player_games()
RETURNS void AS $$
DECLARE
    inactive_game RECORD;
BEGIN
    -- Encontrar jogos com jogadores inativos há mais de 15 segundos
    FOR inactive_game IN
        SELECT id, current_player_turn, turn_start_time
        FROM games 
        WHERE status = 'active' 
        AND current_player_turn IS NOT NULL
        AND turn_start_time < NOW() - INTERVAL '15 seconds'
    LOOP
        -- Verificar se jogador atual está offline
        IF NOT is_player_online(inactive_game.current_player_turn) THEN
            RAISE NOTICE 'Executando jogada automática para jogador offline em cleanup: %', inactive_game.id;
            PERFORM auto_play_for_offline_player(inactive_game.id);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
