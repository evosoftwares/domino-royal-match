
-- Remover todas as políticas existentes que podem causar recursão
DROP POLICY IF EXISTS "Users can view game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can update own player data" ON public.game_players;
DROP POLICY IF EXISTS "System can insert game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can view their games" ON public.games;
DROP POLICY IF EXISTS "Current player can update game" ON public.games;
DROP POLICY IF EXISTS "System can insert games" ON public.games;

-- Criar função Security Definer para verificar se usuário participa do jogo
CREATE OR REPLACE FUNCTION public.user_participates_in_game(p_game_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.game_players
    WHERE game_id = p_game_id AND user_id = p_user_id
  );
$$;

-- Função Security Definer para verificar se usuário é o jogador do turno atual
CREATE OR REPLACE FUNCTION public.is_current_player(p_game_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.games
    WHERE id = p_game_id AND current_player_turn = p_user_id
  );
$$;

-- Políticas RLS sem recursão usando as funções Security Definer

-- Política para game_players: SELECT
CREATE POLICY "Users can view game players without recursion" 
ON public.game_players FOR SELECT
USING (public.user_participates_in_game(game_id));

-- Política para game_players: UPDATE
CREATE POLICY "Users can update own player data" 
ON public.game_players FOR UPDATE
USING (auth.uid() = user_id);

-- Política para game_players: INSERT (sistema)
CREATE POLICY "System can insert game players" 
ON public.game_players FOR INSERT
WITH CHECK (true);

-- Política para games: SELECT
CREATE POLICY "Users can view their games without recursion" 
ON public.games FOR SELECT
USING (public.user_participates_in_game(id));

-- Política para games: UPDATE
CREATE POLICY "Current player can update game" 
ON public.games FOR UPDATE
USING (public.is_current_player(id));

-- Política para games: INSERT (sistema)
CREATE POLICY "System can insert games" 
ON public.games FOR INSERT
WITH CHECK (true);

-- Garantir que RLS está habilitado
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Limpar dados problemáticos da fila para teste limpo
DELETE FROM public.matchmaking_queue WHERE status = 'searching' AND created_at < NOW() - INTERVAL '5 minutes';
