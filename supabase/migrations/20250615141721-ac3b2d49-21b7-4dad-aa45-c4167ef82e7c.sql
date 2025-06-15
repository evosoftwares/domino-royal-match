
-- Função para executar jogada automática quando há timeout
CREATE OR REPLACE FUNCTION handle_player_timeout()
RETURNS TRIGGER AS $$
DECLARE
    game_record RECORD;
    time_since_turn_start INTERVAL;
BEGIN
    -- Verificar se o jogo está ativo
    SELECT * INTO game_record FROM games WHERE id = NEW.id AND status = 'active';
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    -- Calcular tempo desde início do turno
    time_since_turn_start := NOW() - game_record.turn_start_time;
    
    -- Se passou mais de 15 segundos (buffer de segurança), forçar jogada automática
    IF time_since_turn_start > INTERVAL '15 seconds' THEN
        -- Executar jogada automática para o jogador atual
        PERFORM play_piece_periodically(game_record.id);
        
        -- Log da ação
        RAISE NOTICE 'Timeout automático executado para jogo % jogador %', 
            game_record.id, game_record.current_player_turn;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que monitora atualizações na tabela games
DROP TRIGGER IF EXISTS game_timeout_trigger ON games;
CREATE TRIGGER game_timeout_trigger
    AFTER UPDATE OF turn_start_time ON games
    FOR EACH ROW
    WHEN (NEW.status = 'active')
    EXECUTE FUNCTION handle_player_timeout();

-- Função para limpeza periódica de jogos com timeout
CREATE OR REPLACE FUNCTION cleanup_timed_out_games()
RETURNS void AS $$
DECLARE
    timed_out_game RECORD;
BEGIN
    -- Encontrar jogos com mais de 2 minutos de inatividade
    FOR timed_out_game IN
        SELECT id, current_player_turn, turn_start_time
        FROM games 
        WHERE status = 'active' 
        AND turn_start_time < NOW() - INTERVAL '2 minutes'
    LOOP
        RAISE NOTICE 'Executando jogada automática para jogo com timeout: %', timed_out_game.id;
        
        -- Tentar executar jogada automática
        BEGIN
            PERFORM play_piece_periodically(timed_out_game.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao executar jogada automática para jogo %: %', 
                timed_out_game.id, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
