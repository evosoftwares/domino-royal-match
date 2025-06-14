
-- Limpeza completa do sistema de matchmaking e jogos para teste
-- Preserva dados dos usuários (profiles, transactions, auth.users)

-- 1. Limpar fila de matchmaking
DELETE FROM public.matchmaking_queue;

-- 2. Limpar dados de jogadores em jogos (se existir)
DELETE FROM public.game_players;

-- 3. Limpar jogos (se existir)
DELETE FROM public.games;

-- 4. Limpar game rooms (se existir)
DELETE FROM public.game_rooms;

-- 5. Verificação final - mostrar contagem de registros
DO $$
DECLARE
    queue_count integer;
    games_count integer;
    players_count integer;
    rooms_count integer;
BEGIN
    SELECT COUNT(*) INTO queue_count FROM public.matchmaking_queue;
    SELECT COUNT(*) INTO games_count FROM public.games;
    SELECT COUNT(*) INTO players_count FROM public.game_players;
    SELECT COUNT(*) INTO rooms_count FROM public.game_rooms;
    
    RAISE NOTICE '🧹 LIMPEZA COMPLETA REALIZADA!';
    RAISE NOTICE '📊 Registros restantes:';
    RAISE NOTICE '   - Matchmaking Queue: % registros', queue_count;
    RAISE NOTICE '   - Games: % registros', games_count;
    RAISE NOTICE '   - Game Players: % registros', players_count;
    RAISE NOTICE '   - Game Rooms: % registros', rooms_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sistema limpo e pronto para teste!';
    RAISE NOTICE '🎯 Agora você pode testar com 4 usuários diferentes';
    RAISE NOTICE '💡 Dados dos usuários (profiles, transactions) foram preservados';
END $$;
