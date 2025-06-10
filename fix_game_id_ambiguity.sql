-- Script para corrigir a ambiguidade de game_id nos triggers
-- Este erro está acontecendo quando se insere na matchmaking_queue

-- Primeiro, vamos verificar se há triggers problemáticos na tabela matchmaking_queue
-- Execute este script no painel do Supabase

-- 1. Verificar triggers existentes na tabela matchmaking_queue
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'matchmaking_queue'::regclass;

-- 2. Verificar se há funções que referenciam game_id de forma ambígua
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc 
WHERE prosrc LIKE '%game_id%' 
AND prosrc LIKE '%matchmaking%';

-- 3. Corrigir a função play_highest_piece para usar nome qualificado
CREATE OR REPLACE FUNCTION play_highest_piece(p_game_id uuid)
RETURNS void AS $$
DECLARE
    highest_piece_player_id uuid;
    highest_piece_value integer := -1;
    current_piece jsonb;
    player_record RECORD;
    piece_found jsonb;
    updated_hand jsonb;
    next_player_id uuid;
    current_player_position integer;
    total_players integer;
BEGIN
    RAISE NOTICE 'Iniciando play_highest_piece para game_id: %', p_game_id;
    
    -- Loop através de cada jogador para encontrar a peça mais alta
    FOR player_record IN 
        SELECT user_id, hand, position 
        FROM game_players 
        WHERE game_id = p_game_id 
        ORDER BY position
    LOOP
        RAISE NOTICE 'Verificando jogador: %, posição: %', player_record.user_id, player_record.position;
        
        -- Verifica se o jogador tem peças na mão
        IF player_record.hand IS NOT NULL AND jsonb_array_length(player_record.hand) > 0 THEN
            RAISE NOTICE 'Jogador tem % peças', jsonb_array_length(player_record.hand);
            
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
                    RAISE NOTICE 'Peça [%, %] = %', left_val, right_val, piece_sum;
                    
                    -- Verifica se esta é a peça de maior valor encontrada até agora
                    IF piece_sum > highest_piece_value THEN
                        highest_piece_value := piece_sum;
                        highest_piece_player_id := player_record.user_id;
                        current_player_position := player_record.position;
                        piece_found := current_piece;
                        RAISE NOTICE 'Nova peça mais alta encontrada: % (valor: %)', piece_found, piece_sum;
                    END IF;
                END;
            END LOOP;
        END IF;
    END LOOP;

    -- Se encontramos uma peça válida, faça a jogada
    IF highest_piece_value > -1 AND piece_found IS NOT NULL THEN
        RAISE NOTICE 'Jogando peça mais alta: % do jogador: %', piece_found, highest_piece_player_id;
        
        -- Conta total de jogadores
        SELECT COUNT(*) INTO total_players FROM game_players WHERE game_id = p_game_id;
        
        -- Calcula próximo jogador (posição seguinte, com wraparound)
        SELECT user_id INTO next_player_id 
        FROM game_players 
        WHERE game_id = p_game_id 
        AND position = (current_player_position % total_players) + 1;
        
        RAISE NOTICE 'Próximo jogador será: % (posição: %)', next_player_id, (current_player_position % total_players) + 1;
        
        -- Inicializa o board_state se não existir
        UPDATE games 
        SET 
            board_state = COALESCE(board_state, '{}'::jsonb) || jsonb_build_object(
                'pieces', jsonb_build_array(piece_found),
                'leftEnd', CASE 
                    WHEN piece_found ? 'l' THEN (piece_found->>'l')::integer
                    ELSE (piece_found->>0)::integer
                END,
                'rightEnd', CASE 
                    WHEN piece_found ? 'r' THEN (piece_found->>'r')::integer
                    ELSE (piece_found->>1)::integer
                END
            ),
            current_player_turn = next_player_id,
            turn_start_time = NOW(),
            updated_at = NOW()
        WHERE id = p_game_id;

        -- Remove a peça jogada da mão do jogador
        SELECT hand INTO updated_hand 
        FROM game_players 
        WHERE game_id = p_game_id AND user_id = highest_piece_player_id;

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
        WHERE game_id = p_game_id AND user_id = highest_piece_player_id;

        RAISE NOTICE 'Primeira peça jogada automaticamente pelo jogador %, próximo: %', highest_piece_player_id, next_player_id;
    ELSE
        RAISE NOTICE 'Nenhuma peça válida encontrada para jogar automaticamente';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Atualizar a função do trigger com parâmetro qualificado
CREATE OR REPLACE FUNCTION trigger_play_highest_piece()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE 'Trigger acionado para game_id: %, status: %', NEW.id, NEW.status;
    
    -- Executa a função apenas se o jogo estiver ativo e o tabuleiro estiver vazio
    IF NEW.status = 'active' AND (NEW.board_state IS NULL OR NOT (NEW.board_state ? 'pieces') OR jsonb_array_length(NEW.board_state->'pieces') = 0) THEN
        RAISE NOTICE 'Condições atendidas, executando play_highest_piece...';
        PERFORM play_highest_piece(NEW.id);
    ELSE
        RAISE NOTICE 'Condições não atendidas: status=%, board_state=%', NEW.status, NEW.board_state;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Recriar o trigger se necessário
DROP TRIGGER IF EXISTS play_highest_piece_trigger ON games;
CREATE TRIGGER play_highest_piece_trigger
    AFTER INSERT OR UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION trigger_play_highest_piece();

-- 6. Verificar se há outros triggers problemáticos na matchmaking_queue
-- Se houver, eles serão listados na primeira query

COMMENT ON FUNCTION play_highest_piece(uuid) IS 'Função corrigida para evitar ambiguidade de game_id';
COMMENT ON FUNCTION trigger_play_highest_piece() IS 'Trigger corrigido para usar parâmetro qualificado'; 