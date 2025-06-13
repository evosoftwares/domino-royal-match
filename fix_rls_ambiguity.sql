-- Script para corrigir ambiguidade nas políticas RLS
-- Erro: "column reference user_id is ambiguous"

-- 1. Remover a política problemática
DROP POLICY IF EXISTS "Players can see game players" ON game_players;

-- 2. Recriar a política com alias para evitar ambiguidade
CREATE POLICY "Players can see game players" ON game_players FOR SELECT USING (
    game_id IN (
        SELECT gp.game_id 
        FROM game_players gp 
        WHERE gp.user_id = auth.uid()
    )
);

-- 3. Verificar se há outras políticas problemáticas e corrigi-las
DROP POLICY IF EXISTS "Players can see their games" ON games;

-- 4. Recriar política para games com alias
CREATE POLICY "Players can see their games" ON games FOR SELECT USING (
    id IN (
        SELECT gp.game_id 
        FROM game_players gp 
        WHERE gp.user_id = auth.uid()
    )
);

-- 5. Adicionar políticas para INSERT/UPDATE/DELETE se necessário
CREATE POLICY "Players can insert into game_players" ON game_players FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Players can update own game_players" ON game_players FOR UPDATE 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

-- 6. Verificar se as políticas estão funcionando
-- Execute esta query para testar:
-- SELECT * FROM game_players WHERE user_id = auth.uid();

COMMENT ON POLICY "Players can see game players" ON game_players IS 'Política corrigida para evitar ambiguidade de user_id';
COMMENT ON POLICY "Players can see their games" ON games IS 'Política corrigida para evitar ambiguidade de user_id'; 