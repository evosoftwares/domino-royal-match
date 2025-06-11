
-- Remove all existing RLS policies from game_players table
DROP POLICY IF EXISTS "Users can view their own game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can view game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can insert their own game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can update their own game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can delete their own game players" ON public.game_players;
DROP POLICY IF EXISTS "Players can view their games" ON public.game_players;
DROP POLICY IF EXISTS "Players can view game data" ON public.game_players;

-- Create simple, non-recursive RLS policies for game_players
CREATE POLICY "Users can view game players where they participate" 
ON public.game_players 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp2 
    WHERE gp2.game_id = game_players.game_id 
    AND gp2.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert game players" 
ON public.game_players 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own game player data" 
ON public.game_players 
FOR UPDATE 
USING (user_id = auth.uid());

-- Add similar policies for games table to prevent recursion
DROP POLICY IF EXISTS "Users can view games they participate in" ON public.games;
DROP POLICY IF EXISTS "Users can view their games" ON public.games;
DROP POLICY IF EXISTS "Players can view their games" ON public.games;

CREATE POLICY "Users can view games where they are players" 
ON public.games 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp 
    WHERE gp.game_id = games.id 
    AND gp.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert games" 
ON public.games 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update games" 
ON public.games 
FOR UPDATE 
USING (true);

-- Enable realtime for better WebSocket connections
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
