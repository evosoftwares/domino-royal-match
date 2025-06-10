-- SCRIPT PARA EXECUTAR MANUALMENTE NO PAINEL DO SUPABASE
-- Este script implementa a jogada automática da primeira peça (peça mais alta)

-- Função para jogar automaticamente a peça mais alta na primeira jogada
CREATE OR REPLACE FUNCTION play_highest_piece(game_id uuid)
RETURNS void AS $$
DECLARE
    highest_piece_player_id uuid;
    highest_piece_value integer := -1;
    current_piece jsonb;
    player_record RECORD;
    piece_found jsonb;
    updated_hand jsonb;
BEGIN
    -- Loop através de cada jogador para encontrar a peça mais alta
    FOR player_record IN 
        SELECT user_id, hand FROM game_players WHERE game_id = play_highest_piece.game_id
    LOOP
        -- Verifica se o jogador tem peças na mão
        IF player_record.hand IS NOT NULL AND jsonb_array_length(player_record.hand) > 0 THEN
            -- Loop através das peças do jogador
            FOR i IN 0..jsonb_array_length(player_record.hand)-1 LOOP
                current_piece := player_record.hand->i;
                
                -- Extrai valores da peça (suporta formatos {l, r} ou [v1, v2])
                DECLARE
                    piece_sum integer;
                    left_val integer;
                    right_val integer;
                BEGIN
                    -- Formato {l: number, r: number}
                    IF current_piece ? 'l' AND current_piece ? 'r' THEN
                        left_val := (current_piece->>'l')::integer;
                        right_val := (current_piece->>'r')::integer;
                    -- Formato array [number, number]
                    ELSIF jsonb_array_length(current_piece) = 2 THEN
                        left_val := (current_piece->>0)::integer;
                        right_val := (current_piece->>1)::integer;
                    ELSE
                        CONTINUE; -- Formato não reconhecido, pula para próxima peça
                    END IF;
                    
                    piece_sum := left_val + right_val;
                    
                    -- Verifica se esta é a peça de maior valor encontrada até agora
                    IF piece_sum > highest_piece_value THEN
                        highest_piece_value := piece_sum;
                        highest_piece_player_id := player_record.user_id;
                        piece_found := current_piece;
                    END IF;
                END;
            END LOOP;
        END IF;
    END LOOP;

    -- Se encontramos uma peça válida, faça a jogada
    IF highest_piece_value > -1 AND piece_found IS NOT NULL THEN
        -- Inicializa o board_state se não existir
        UPDATE games 
        SET board_state = COALESCE(board_state, '{}'::jsonb) || jsonb_build_object(
            'pieces', jsonb_build_array(piece_found),
            'leftEnd', CASE 
                WHEN piece_found ? 'l' THEN (piece_found->>'l')::integer
                ELSE (piece_found->>0)::integer
            END,
            'rightEnd', CASE 
                WHEN piece_found ? 'r' THEN (piece_found->>'r')::integer
                ELSE (piece_found->>1)::integer
            END
        )
        WHERE id = play_highest_piece.game_id;

        -- Remove a peça jogada da mão do jogador
        SELECT hand INTO updated_hand 
        FROM game_players 
        WHERE game_id = play_highest_piece.game_id AND user_id = highest_piece_player_id;

        -- Reconstrói o array da mão sem a peça jogada
        SELECT jsonb_agg(piece) INTO updated_hand
        FROM (
            SELECT piece
            FROM jsonb_array_elements(updated_hand) AS piece
            WHERE piece != piece_found
        ) AS remaining_pieces;

        -- Atualiza a mão do jogador
        UPDATE game_players 
        SET hand = COALESCE(updated_hand, '[]'::jsonb)
        WHERE game_id = play_highest_piece.game_id AND user_id = highest_piece_player_id;

        -- Define o próximo jogador (incrementa a posição de forma circular)
        UPDATE games 
        SET current_player_turn = (
            SELECT user_id 
            FROM game_players 
            WHERE game_id = play_highest_piece.game_id 
            AND position = (
                (SELECT position FROM game_players 
                 WHERE game_id = play_highest_piece.game_id AND user_id = highest_piece_player_id) % 
                (SELECT COUNT(*) FROM game_players WHERE game_id = play_highest_piece.game_id)
            ) + 1
        )
        WHERE id = play_highest_piece.game_id;

        RAISE NOTICE 'Primeira peça jogada automaticamente pelo jogador %', highest_piece_player_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger para executar a função quando um novo jogo é inserido
CREATE OR REPLACE FUNCTION trigger_play_highest_piece()
RETURNS TRIGGER AS $$
BEGIN
    -- Executa a função apenas se o jogo estiver ativo e o tabuleiro estiver vazio
    IF NEW.status = 'active' AND (NEW.board_state IS NULL OR NOT (NEW.board_state ? 'pieces') OR jsonb_array_length(NEW.board_state->'pieces') = 0) THEN
        PERFORM play_highest_piece(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria o trigger
DROP TRIGGER IF EXISTS play_highest_piece_trigger ON games;
CREATE TRIGGER play_highest_piece_trigger
    AFTER INSERT OR UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION trigger_play_highest_piece();

-- Para testar a função manualmente em um jogo existente (opcional):
-- SELECT play_highest_piece('your-game-id-here');

-- Para verificar se as funções foram criadas:
-- SELECT proname FROM pg_proc WHERE proname IN ('play_highest_piece', 'trigger_play_highest_piece');

-- Para verificar se o trigger foi criado:
-- SELECT tgname FROM pg_trigger WHERE tgname = 'play_highest_piece_trigger'; 