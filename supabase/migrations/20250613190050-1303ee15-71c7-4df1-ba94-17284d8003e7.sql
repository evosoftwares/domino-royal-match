
-- Criar função que será executada pelo trigger
CREATE OR REPLACE FUNCTION auto_create_game_on_queue_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    queue_count integer;
    result jsonb;
BEGIN
    -- Contar quantos jogadores estão na fila para dominó (idjogopleiteado = 1)
    SELECT COUNT(*) INTO queue_count
    FROM matchmaking_queue 
    WHERE status = 'searching' AND idjogopleiteado = 1;
    
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

-- Criar trigger que executa após INSERT ou UPDATE na matchmaking_queue
DROP TRIGGER IF EXISTS trigger_auto_create_game ON matchmaking_queue;
CREATE TRIGGER trigger_auto_create_game
    AFTER INSERT OR UPDATE ON matchmaking_queue
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_game_on_queue_change();

-- Habilitar realtime para a tabela games (apenas se ainda não estiver)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'games'
    ) THEN
        ALTER TABLE games REPLICA IDENTITY FULL;
        ALTER publication supabase_realtime ADD TABLE games;
    END IF;
END $$;
