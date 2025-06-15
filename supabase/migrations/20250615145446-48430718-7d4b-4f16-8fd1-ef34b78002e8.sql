
-- Criar tabela de solicitações
CREATE TABLE public.solicitacoes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id UUID NOT NULL,
    user_id UUID NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('auto_play', 'pass_turn')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    processed_at TIMESTAMP WITH TIME ZONE,
    timeout_duration INTEGER DEFAULT 10,
    error_message TEXT
);

-- Índices para melhor performance
CREATE INDEX idx_solicitacoes_game_user ON public.solicitacoes(game_id, user_id);
CREATE INDEX idx_solicitacoes_status ON public.solicitacoes(status);
CREATE INDEX idx_solicitacoes_created_at ON public.solicitacoes(created_at);

-- Trigger para criar solicitação quando timeout acontece
CREATE OR REPLACE FUNCTION check_game_timeout()
RETURNS TRIGGER AS $$
DECLARE
    time_since_turn_start INTERVAL;
    existing_request_count INTEGER;
BEGIN
    -- Verificar se o jogo está ativo
    IF NEW.status != 'active' OR NEW.current_player_turn IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Calcular tempo desde início do turno
    time_since_turn_start := NOW() - NEW.turn_start_time;
    
    -- Se passou mais de 10 segundos
    IF time_since_turn_start > INTERVAL '10 seconds' THEN
        -- Verificar se já existe solicitação pendente para este jogo/jogador
        SELECT COUNT(*) INTO existing_request_count
        FROM public.solicitacoes
        WHERE game_id = NEW.id 
        AND user_id = NEW.current_player_turn 
        AND status = 'pending'
        AND created_at > NOW() - INTERVAL '30 seconds';
        
        -- Se não existe solicitação pendente, criar uma
        IF existing_request_count = 0 THEN
            INSERT INTO public.solicitacoes (game_id, user_id, tipo, timeout_duration)
            VALUES (NEW.id, NEW.current_player_turn, 'auto_play', 10);
            
            RAISE NOTICE 'Solicitação de jogada automática criada para jogo % jogador %', 
                NEW.id, NEW.current_player_turn;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger na tabela games
CREATE TRIGGER trigger_check_game_timeout
    AFTER UPDATE ON public.games
    FOR EACH ROW
    EXECUTE FUNCTION check_game_timeout();

-- Função para processar solicitações automaticamente
CREATE OR REPLACE FUNCTION process_auto_play_request(request_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    request_record RECORD;
    game_record RECORD;
    current_player RECORD;
    player_hand JSONB;
    piece_to_play JSONB;
    board_ends JSONB;
    new_board_state JSONB;
    next_player_id UUID;
    success BOOLEAN := FALSE;
BEGIN
    -- Buscar solicitação
    SELECT * INTO request_record FROM public.solicitacoes 
    WHERE id = request_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Marcar como processando
    UPDATE public.solicitacoes 
    SET status = 'processing', processed_at = NOW()
    WHERE id = request_id;
    
    -- Buscar dados do jogo
    SELECT * INTO game_record FROM public.games 
    WHERE id = request_record.game_id AND status = 'active';
    
    IF NOT FOUND THEN
        UPDATE public.solicitacoes 
        SET status = 'failed', error_message = 'Jogo não encontrado ou não ativo'
        WHERE id = request_id;
        RETURN FALSE;
    END IF;
    
    -- Verificar se ainda é a vez do jogador
    IF game_record.current_player_turn != request_record.user_id THEN
        UPDATE public.solicitacoes 
        SET status = 'completed', error_message = 'Jogador já jogou'
        WHERE id = request_id;
        RETURN TRUE;
    END IF;
    
    -- Buscar dados do jogador atual
    SELECT * INTO current_player FROM public.game_players 
    WHERE game_id = request_record.game_id AND user_id = request_record.user_id;
    
    IF NOT FOUND THEN
        UPDATE public.solicitacoes 
        SET status = 'failed', error_message = 'Jogador não encontrado'
        WHERE id = request_id;
        RETURN FALSE;
    END IF;
    
    player_hand := current_player.hand;
    
    -- Extrair extremidades do tabuleiro
    board_ends := CASE 
        WHEN jsonb_array_length(game_record.board_state->'pieces') = 0 THEN 
            '{"left": null, "right": null}'::jsonb
        ELSE 
            jsonb_build_object(
                'left', (game_record.board_state->'left_end')::integer,
                'right', (game_record.board_state->'right_end')::integer
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
    SELECT user_id INTO next_player_id 
    FROM public.game_players 
    WHERE game_id = request_record.game_id 
    AND position = (
        SELECT CASE WHEN current_player.position >= (SELECT COUNT(*) FROM public.game_players WHERE game_id = request_record.game_id) 
                   THEN 1 
                   ELSE current_player.position + 1 
               END
    );
    
    IF piece_to_play IS NOT NULL THEN
        -- Jogar a peça
        DECLARE
            piece_l INTEGER := (piece_to_play->>'l')::integer;
            piece_r INTEGER := (piece_to_play->>'r')::integer;
            left_end INTEGER := (board_ends->>'left')::integer;
            right_end INTEGER := (board_ends->>'right')::integer;
            new_pieces JSONB;
            updated_hand JSONB;
            new_left_end INTEGER;
            new_right_end INTEGER;
        BEGIN
            -- Determinar como conectar a peça
            IF board_ends->>'left' IS NULL THEN
                -- Primeira peça do jogo
                new_pieces := jsonb_build_array(jsonb_build_object('piece', piece_to_play, 'orientation', 'horizontal'));
                new_left_end := piece_l;
                new_right_end := piece_r;
            ELSIF piece_l = left_end THEN
                -- Conectar no lado esquerdo, virar peça
                new_pieces := jsonb_build_array(jsonb_build_object('piece', jsonb_build_object('l', piece_r, 'r', piece_l), 'orientation', 'horizontal')) || (game_record.board_state->'pieces');
                new_left_end := piece_r;
                new_right_end := (game_record.board_state->>'right_end')::integer;
            ELSIF piece_r = left_end THEN
                -- Conectar no lado esquerdo, manter orientação
                new_pieces := jsonb_build_array(jsonb_build_object('piece', piece_to_play, 'orientation', 'horizontal')) || (game_record.board_state->'pieces');
                new_left_end := piece_l;
                new_right_end := (game_record.board_state->>'right_end')::integer;
            ELSIF piece_l = right_end THEN
                -- Conectar no lado direito, manter orientação
                new_pieces := (game_record.board_state->'pieces') || jsonb_build_array(jsonb_build_object('piece', piece_to_play, 'orientation', 'horizontal'));
                new_left_end := (game_record.board_state->>'left_end')::integer;
                new_right_end := piece_r;
            ELSE
                -- Conectar no lado direito, virar peça
                new_pieces := (game_record.board_state->'pieces') || jsonb_build_array(jsonb_build_object('piece', jsonb_build_object('l', piece_r, 'r', piece_l), 'orientation', 'horizontal'));
                new_left_end := (game_record.board_state->>'left_end')::integer;
                new_right_end := piece_l;
            END IF;
            
            new_board_state := jsonb_build_object(
                'pieces', new_pieces,
                'left_end', new_left_end,
                'right_end', new_right_end
            );
            
            -- Remover peça da mão
            updated_hand := '[]'::jsonb;
            FOR i IN 0..(jsonb_array_length(player_hand) - 1) LOOP
                IF player_hand->i != piece_to_play THEN
                    updated_hand := updated_hand || jsonb_build_array(player_hand->i);
                END IF;
            END LOOP;
            
            -- Atualizar jogo
            UPDATE public.games SET 
                board_state = new_board_state,
                current_player_turn = next_player_id,
                consecutive_passes = 0,
                turn_start_time = NOW(),
                updated_at = NOW()
            WHERE id = request_record.game_id;
            
            -- Atualizar mão do jogador
            UPDATE public.game_players SET 
                hand = updated_hand,
                updated_at = NOW()
            WHERE id = current_player.id;
            
            success := TRUE;
            
            RAISE NOTICE 'Jogada automática executada: peça [%|%] para jogador %', 
                piece_l, piece_r, request_record.user_id;
        END;
    ELSE
        -- Passar a vez
        UPDATE public.games SET 
            current_player_turn = next_player_id,
            consecutive_passes = COALESCE(consecutive_passes, 0) + 1,
            turn_start_time = NOW(),
            updated_at = NOW()
        WHERE id = request_record.game_id;
        
        success := TRUE;
        
        RAISE NOTICE 'Jogador % passou a vez automaticamente', request_record.user_id;
    END IF;
    
    -- Marcar solicitação como completa
    UPDATE public.solicitacoes 
    SET status = 'completed'
    WHERE id = request_id;
    
    RETURN success;
    
EXCEPTION WHEN OTHERS THEN
    -- Marcar como falha em caso de erro
    UPDATE public.solicitacoes 
    SET status = 'failed', error_message = SQLERRM
    WHERE id = request_id;
    
    RAISE NOTICE 'Erro ao processar solicitação %: %', request_id, SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Trigger para processar solicitações automaticamente
CREATE OR REPLACE FUNCTION trigger_process_solicitacao()
RETURNS TRIGGER AS $$
BEGIN
    -- Processar apenas solicitações pendentes
    IF NEW.status = 'pending' THEN
        PERFORM process_auto_play_request(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger na tabela solicitacoes
CREATE TRIGGER trigger_process_new_solicitacao
    AFTER INSERT ON public.solicitacoes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_process_solicitacao();

-- Função de limpeza de solicitações antigas
CREATE OR REPLACE FUNCTION cleanup_old_solicitacoes()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.solicitacoes 
    WHERE created_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Limpeza: % solicitações antigas removidas', deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
