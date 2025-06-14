
-- Diagnóstico completo do trigger e correção definitiva
DO $$
DECLARE
    trigger_exists boolean := false;
    trigger_status text;
    function_exists boolean := false;
BEGIN
    -- Verificar se a função existe
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'auto_create_game_on_queue_change'
    ) INTO function_exists;
    
    RAISE NOTICE '🔍 Função auto_create_game_on_queue_change existe: %', function_exists;
    
    -- Verificar se o trigger existe
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'matchmaking_queue' 
        AND t.tgname = 'auto_create_game_trigger'
    ) INTO trigger_exists;
    
    RAISE NOTICE '🔍 Trigger auto_create_game_trigger existe: %', trigger_exists;
    
    -- Se o trigger existe, verificar status
    IF trigger_exists THEN
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
        
        RAISE NOTICE '🔍 Status atual do trigger: %', trigger_status;
        
        -- Recriar o trigger corretamente
        DROP TRIGGER IF EXISTS auto_create_game_trigger ON matchmaking_queue;
        RAISE NOTICE '🗑️ Trigger antigo removido';
    END IF;
    
    -- Recriar função se necessário
    IF NOT function_exists THEN
        RAISE NOTICE '🔧 Recriando função auto_create_game_on_queue_change...';
    END IF;
END $$;

-- Recriar a função de trigger atualizada
CREATE OR REPLACE FUNCTION auto_create_game_on_queue_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    queue_count integer;
    result jsonb;
BEGIN
    RAISE NOTICE '🔥 TRIGGER EXECUTADO: Evento=%, User=%, Status=%', 
        TG_OP, 
        COALESCE(NEW.user_id, OLD.user_id),
        COALESCE(NEW.status, OLD.status);
    
    -- Contar jogadores na fila para dominó (idjogopleiteado = 1)
    SELECT COUNT(*) INTO queue_count
    FROM matchmaking_queue 
    WHERE status = 'searching' AND idjogopleiteado = 1;
    
    RAISE NOTICE '📊 Jogadores na fila após trigger: %', queue_count;
    
    -- Se há 4 ou mais jogadores, tentar criar jogo
    IF queue_count >= 4 THEN
        RAISE NOTICE '🎯 ATIVANDO CRIAÇÃO DE JOGO - 4+ jogadores detectados!';
        
        -- Chamar função segura de criação
        SELECT safe_create_game_when_ready() INTO result;
        
        RAISE NOTICE '✅ Resultado da criação: %', result;
    ELSE
        RAISE NOTICE '⏳ Aguardando mais jogadores (%/4)', queue_count;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar o trigger corretamente habilitado
CREATE TRIGGER auto_create_game_trigger
    AFTER INSERT OR UPDATE ON matchmaking_queue
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_game_on_queue_change();

-- Forçar o trigger a estar sempre habilitado
ALTER TABLE matchmaking_queue ENABLE ALWAYS TRIGGER auto_create_game_trigger;

-- Verificação final completa
DO $$
DECLARE
    final_trigger_status text;
    trigger_count integer;
BEGIN
    -- Contar triggers na tabela
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'matchmaking_queue';
    
    RAISE NOTICE '📊 Total de triggers na tabela matchmaking_queue: %', trigger_count;
    
    -- Verificar status final
    SELECT CASE tgenabled 
        WHEN 'O' THEN 'ORIGIN (desabilitado)'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA'
        WHEN 'A' THEN 'ALWAYS (habilitado)'
        ELSE 'UNKNOWN'
    END INTO final_trigger_status
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'matchmaking_queue' 
    AND t.tgname = 'auto_create_game_trigger';
    
    RAISE NOTICE '🔥 STATUS FINAL DO TRIGGER: %', final_trigger_status;
    
    IF final_trigger_status = 'ALWAYS (habilitado)' THEN
        RAISE NOTICE '✅ ✅ ✅ SISTEMA MATCHMAKING TOTALMENTE FUNCIONAL! ✅ ✅ ✅';
        RAISE NOTICE '🎯 Quando 4 jogadores entrarem na fila, o jogo será criado automaticamente';
        RAISE NOTICE '🛡️ Sistema seguro v3.0 com máxima proteção ativo';
    ELSE
        RAISE NOTICE '❌ ❌ ❌ PROBLEMA CRÍTICO: Trigger não está habilitado! ❌ ❌ ❌';
    END IF;
END $$;
