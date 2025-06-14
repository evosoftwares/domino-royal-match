-- Script para corrigir ambiguidade de user_id na tabela matchmaking_queue
-- Execute este script no painel do Supabase (SQL Editor)

-- 1. Verificar triggers existentes na tabela matchmaking_queue
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled,
    proname as function_name,
    prosrc as function_body
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'matchmaking_queue'::regclass;

-- 2. Verificar funções que referenciam user_id e matchmaking
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc 
WHERE prosrc LIKE '%user_id%' 
AND prosrc LIKE '%matchmaking%';

-- 3. Verificar políticas RLS que podem ter ambiguidade
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'matchmaking_queue';

-- 4. Desabilitar temporariamente RLS para teste (CUIDADO: apenas para diagnóstico)
-- DESCOMENTE apenas se necessário para teste:
-- ALTER TABLE matchmaking_queue DISABLE ROW LEVEL SECURITY;

-- 5. Recriar políticas RLS com aliases adequados
DROP POLICY IF EXISTS "Users can see queue" ON matchmaking_queue;
DROP POLICY IF EXISTS "Users can manage own queue entry" ON matchmaking_queue;

-- Política para visualizar a fila
CREATE POLICY "Users can see queue" ON matchmaking_queue 
FOR SELECT TO authenticated;

-- Política para gerenciar própria entrada na fila
CREATE POLICY "Users can manage own queue entry" ON matchmaking_queue 
FOR ALL USING (auth.uid() = matchmaking_queue.user_id);

-- 6. Reabilitar RLS
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- 7. Verificar se há triggers problemáticos e removê-los se necessário
-- Se houver triggers que causam ambiguidade, eles serão listados na primeira query
-- Exemplo de como remover um trigger problemático:
-- DROP TRIGGER IF EXISTS nome_do_trigger_problematico ON matchmaking_queue;

-- 8. Verificar estrutura final
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'matchmaking_queue' 
AND table_schema = 'public'
ORDER BY ordinal_position;

COMMENT ON SCRIPT IS 'Script para corrigir ambiguidade de user_id na tabela matchmaking_queue'; 