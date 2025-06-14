
-- Remover TODAS as políticas existentes das tabelas relevantes
DROP POLICY IF EXISTS "Users can view players in their games" ON public.game_players;
DROP POLICY IF EXISTS "Users can update their own player data" ON public.game_players;
DROP POLICY IF EXISTS "Users can view game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can update own player data" ON public.game_players;
DROP POLICY IF EXISTS "System can insert game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can view their games" ON public.games;
DROP POLICY IF EXISTS "Current player can update the game" ON public.games;
DROP POLICY IF EXISTS "Current player can update game" ON public.games;
DROP POLICY IF EXISTS "System can insert games" ON public.games;

-- Recriar políticas RLS mais simples e sem recursão
-- Política para game_players: usuários podem ver jogadores nos seus jogos
CREATE POLICY "Users can view game players" 
ON public.game_players FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp2 
    WHERE gp2.game_id = game_players.game_id 
    AND gp2.user_id = auth.uid()
  )
);

-- Política para game_players: usuários podem atualizar apenas seus próprios dados
CREATE POLICY "Users can update own player data" 
ON public.game_players FOR UPDATE
USING (auth.uid() = user_id);

-- Política para game_players: sistema pode inserir jogadores (para criação de jogos)
CREATE POLICY "System can insert game players" 
ON public.game_players FOR INSERT
WITH CHECK (true);

-- Política para games: usuários podem ver jogos onde participam
CREATE POLICY "Users can view their games" 
ON public.games FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp 
    WHERE gp.game_id = games.id 
    AND gp.user_id = auth.uid()
  )
);

-- Política para games: jogador atual pode atualizar o jogo
CREATE POLICY "Current player can update game" 
ON public.games FOR UPDATE
USING (auth.uid() = current_player_turn);

-- Política para games: sistema pode inserir jogos (para criação automática)
CREATE POLICY "System can insert games" 
ON public.games FOR INSERT
WITH CHECK (true);
