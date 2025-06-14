
-- LIMPEZA FINAL DAS POLÍTICAS RLS RESTANTES (VERSÃO CORRIGIDA)
-- Remove todas as políticas RLS sem modificar pg_class diretamente

DO $$
DECLARE
    policy_record RECORD;
    total_policies_before integer;
    total_policies_after integer;
    table_record RECORD;
BEGIN
    -- Contar políticas antes da limpeza
    SELECT COUNT(*) INTO total_policies_before
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    RAISE NOTICE '🧹 INICIANDO LIMPEZA FINAL DE POLÍTICAS RLS (VERSÃO SEGURA)';
    RAISE NOTICE '📊 Políticas encontradas antes da limpeza: %', total_policies_before;
    
    -- Remover TODAS as políticas RLS restantes, independente do nome
    FOR policy_record IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        RAISE NOTICE '🗑️ Removendo política: % da tabela %', policy_record.policyname, policy_record.tablename;
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, policy_record.tablename);
    END LOOP;
    
    -- Usar ALTER TABLE para desabilitar RLS (método seguro)
    FOR table_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN ('games', 'game_players', 'matchmaking_queue', 'profiles', 'transactions', 'player_presence', 'game_rooms')
    LOOP
        RAISE NOTICE '🔓 Desabilitando RLS na tabela: %', table_record.table_name;
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', table_record.table_name);
    END LOOP;
    
    -- Contar políticas após a limpeza
    SELECT COUNT(*) INTO total_policies_after
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    RAISE NOTICE '🔍 VERIFICAÇÃO FINAL COMPLETA:';
    RAISE NOTICE '📊 Políticas antes: % | Políticas depois: %', total_policies_before, total_policies_after;
    
    -- Verificar status RLS de cada tabela
    FOR table_record IN 
        SELECT t.table_name,
               CASE WHEN c.relrowsecurity THEN 'HABILITADO' ELSE 'DESABILITADO' END as rls_status
        FROM information_schema.tables t
        JOIN pg_class c ON c.relname = t.table_name
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND n.nspname = 'public'
        AND t.table_name IN ('games', 'game_players', 'matchmaking_queue', 'profiles', 'transactions', 'player_presence', 'game_rooms')
    LOOP
        RAISE NOTICE '📋 Tabela % - RLS: %', table_record.table_name, table_record.rls_status;
    END LOOP;
    
    IF total_policies_after = 0 THEN
        RAISE NOTICE '✅ ✅ ✅ SISTEMA COMPLETAMENTE LIMPO! ✅ ✅ ✅';
        RAISE NOTICE '🚀 Zero políticas RLS restantes';
        RAISE NOTICE '🎯 RLS desabilitado em todas as tabelas principais';
        RAISE NOTICE '📈 Performance otimizada ao máximo';
        RAISE NOTICE '🔓 Acesso completo aos dados liberado';
        RAISE NOTICE '🎮 Sistema de matchmaking pronto para uso otimizado!';
    ELSE
        RAISE NOTICE '❌ ATENÇÃO: % políticas ainda permanecem ativas', total_policies_after;
        
        -- Listar políticas restantes para debug
        FOR policy_record IN 
            SELECT tablename, policyname 
            FROM pg_policies 
            WHERE schemaname = 'public'
        LOOP
            RAISE NOTICE '⚠️ Política restante: % na tabela %', policy_record.policyname, policy_record.tablename;
        END LOOP;
    END IF;
END $$;
