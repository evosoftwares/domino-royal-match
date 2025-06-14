
-- SOLUÇÃO CRÍTICA: Reabilitar o trigger que estava desabilitado
ALTER TABLE public.matchmaking_queue ENABLE TRIGGER auto_create_game_trigger;

-- Verificar se todas as tabelas têm realtime ativo
ALTER TABLE public.matchmaking_queue REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.game_players REPLICA IDENTITY FULL;

-- Garantir que estão na publicação realtime
DO $$
BEGIN
    -- matchmaking_queue
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'matchmaking_queue'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;
    END IF;
    
    -- games
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'games'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
    END IF;
    
    -- game_players
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'game_players'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
    END IF;
END $$;

-- Teste final para verificar se o trigger está funcionando
DO $$
DECLARE
    trigger_status text;
BEGIN
    SELECT CASE tgenabled 
        WHEN 'O' THEN 'ORIGIN (desabilitado)'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA'
        WHEN 'A' THEN 'ALWAYS (habilitado)'
        ELSE 'UNKNOWN'
    END INTO trigger_status
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'matchmaking_queue' 
    AND t.tgname = 'auto_create_game_trigger';
    
    RAISE NOTICE '🔥 STATUS DO TRIGGER: %', trigger_status;
    
    IF trigger_status = 'ALWAYS (habilitado)' THEN
        RAISE NOTICE '✅ SISTEMA MATCHMAKING TOTALMENTE FUNCIONAL!';
        RAISE NOTICE '🎯 Quando 4 jogadores entrarem na fila, o jogo será criado automaticamente';
    ELSE
        RAISE NOTICE '❌ PROBLEMA: Trigger ainda não está habilitado corretamente';
    END IF;
END $$;
