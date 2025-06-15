
-- Passo 1: Remover todos os gatilhos (triggers) relacionados à criação de jogos.
-- A ordem é importante: primeiro os gatilhos, depois as funções que eles usam.
DROP TRIGGER IF EXISTS auto_create_game_on_queue_change_trigger ON public.matchmaking_queue;
DROP TRIGGER IF EXISTS trigger_auto_create_game ON public.matchmaking_queue;
DROP TRIGGER IF EXISTS auto_create_game_trigger ON public.matchmaking_queue;
DROP TRIGGER IF EXISTS trigger_play_highest_piece_on_creation ON public.games;

-- Passo 2: Remover as funções que os gatilhos usavam.
-- Agora que os gatilhos foram removidos, as funções não têm mais dependências e podem ser removidas com segurança.
DROP FUNCTION IF EXISTS public.auto_create_game_on_queue_change();
DROP FUNCTION IF EXISTS public.safe_auto_create_game_on_queue_change();
DROP FUNCTION IF EXISTS public.safe_create_game_when_ready();
DROP FUNCTION IF EXISTS public.create_game_when_ready();
DROP FUNCTION IF EXISTS public.trigger_play_highest_piece();
DROP FUNCTION IF EXISTS public.play_highest_piece(p_game_id uuid);
