-- Script para testar se o trigger da primeira peça está funcionando
-- Execute este script no painel do Supabase (SQL Editor)

-- 1. Verificar se as funções existem
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname IN ('play_highest_piece', 'trigger_play_highest_piece');

-- 2. Verificar se o trigger existe
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgname = 'play_highest_piece_trigger';

-- 3. Testar a criação de um jogo fictício (TESTE)
-- ATENÇÃO: Este é apenas um teste - não execute em produção com dados reais
-- Primeiro, vamos ver um jogo existente para entender a estrutura:
SELECT 
    g.id, 
    g.status, 
    g.board_state,
    COUNT(gp.user_id) as player_count
FROM games g
LEFT JOIN game_players gp ON g.id = gp.game_id
GROUP BY g.id, g.status, g.board_state
LIMIT 5;

-- 4. Ver jogadores de um jogo específico para entender a estrutura das mãos
SELECT 
    gp.user_id,
    gp.position,
    gp.hand,
    jsonb_array_length(COALESCE(gp.hand, '[]'::jsonb)) as hand_size
FROM game_players gp
WHERE gp.game_id IN (
    SELECT id FROM games 
    WHERE status = 'active' 
    LIMIT 1
)
ORDER BY gp.position;

-- 5. Verificar se há jogos com tabuleiro vazio (que deveriam ter acionado o trigger)
SELECT 
    g.id,
    g.status,
    g.created_at,
    g.board_state,
    CASE 
        WHEN g.board_state IS NULL THEN 'board_state é NULL'
        WHEN NOT (g.board_state ? 'pieces') THEN 'sem chave pieces'
        WHEN jsonb_array_length(g.board_state->'pieces') = 0 THEN 'array pieces vazio'
        ELSE 'tabuleiro com peças'
    END as board_status
FROM games g
WHERE g.status = 'active'
ORDER BY g.created_at DESC
LIMIT 10; 