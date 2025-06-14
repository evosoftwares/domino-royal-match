-- Script para corrigir a estrutura da tabela matchmaking_queue
-- Execute este script no painel do Supabase (SQL Editor)

-- 1. Verificar a estrutura atual da tabela
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'matchmaking_queue' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar se a coluna idjogopleiteado existe e tem restrição NOT NULL
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.matchmaking_queue'::regclass;

-- 3. Opção A: Remover a coluna idjogopleiteado (se ela não for necessária)
-- DESCOMENTE a linha abaixo se quiser remover a coluna:
-- ALTER TABLE matchmaking_queue DROP COLUMN IF EXISTS idjogopleiteado;

-- 4. Opção B: Tornar a coluna idjogopleiteado opcional (permitir NULL)
-- DESCOMENTE as linhas abaixo se quiser manter a coluna mas torná-la opcional:
-- ALTER TABLE matchmaking_queue ALTER COLUMN idjogopleiteado DROP NOT NULL;
-- ALTER TABLE matchmaking_queue ALTER COLUMN idjogopleiteado SET DEFAULT NULL;

-- 5. Opção C: Adicionar um valor padrão para a coluna
-- DESCOMENTE as linhas abaixo se quiser manter a coluna com um valor padrão:
-- ALTER TABLE matchmaking_queue ALTER COLUMN idjogopleiteado SET DEFAULT uuid_generate_v4();
-- ALTER TABLE matchmaking_queue ALTER COLUMN idjogopleiteado DROP NOT NULL;

-- 6. Verificar a estrutura após as alterações
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'matchmaking_queue' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Limpar dados inconsistentes (se houver)
-- DELETE FROM matchmaking_queue WHERE status IS NULL OR user_id IS NULL;

COMMENT ON SCRIPT IS 'Script para corrigir problema da coluna idjogopleiteado na tabela matchmaking_queue'; 