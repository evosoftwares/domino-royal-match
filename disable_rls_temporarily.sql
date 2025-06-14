-- Script para desabilitar temporariamente RLS na matchmaking_queue
-- ATENÇÃO: Execute apenas para testes, reabilite depois!

-- 1. Desabilitar RLS temporariamente
ALTER TABLE matchmaking_queue DISABLE ROW LEVEL SECURITY;

-- 2. Verificar se RLS está desabilitado
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables 
WHERE tablename = 'matchmaking_queue';

-- 3. Para reabilitar depois dos testes, execute:
-- ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

COMMENT ON SCRIPT IS 'Desabilita RLS temporariamente para testes - REABILITE DEPOIS!'; 