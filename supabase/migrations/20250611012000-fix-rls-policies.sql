
-- Remove all existing RLS policies from game_players table to prevent infinite recursion
DROP POLICY IF EXISTS "Users can view their own game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can view game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can insert their own game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can update their own game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can delete their own game players" ON public.game_players;
DROP POLICY IF EXISTS "Players can view their games" ON public.game_players;
DROP POLICY IF EXISTS "Players can view game data" ON public.game_players;
DROP POLICY IF EXISTS "Users can view game players where they participate" ON public.game_players;
DROP POLICY IF EXISTS "System can insert game players" ON public.game_players;
DROP POLICY IF EXISTS "Users can update their own game player data" ON public.game_players;

-- Remove all existing RLS policies from games table
DROP POLICY IF EXISTS "Users can view games they participate in" ON public.games;
DROP POLICY IF EXISTS "Users can view their games" ON public.games;
DROP POLICY IF EXISTS "Players can view their games" ON public.games;
DROP POLICY IF EXISTS "Users can view games where they are players" ON public.games;
DROP POLICY IF EXISTS "System can insert games" ON public.games;
DROP POLICY IF EXISTS "System can update games" ON public.games;

-- Create simple, non-recursive RLS policies for game_players
CREATE POLICY "Users can view game players for their games" 
ON public.game_players 
FOR SELECT 
USING (
  game_id IN (
    SELECT g.id FROM public.games g
    JOIN public.game_players gp ON g.id = gp.game_id
    WHERE gp.user_id = auth.uid()
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

-- Create simple policies for games table
CREATE POLICY "Users can view their games" 
ON public.games 
FOR SELECT 
USING (
  id IN (
    SELECT game_id FROM public.game_players 
    WHERE user_id = auth.uid()
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

-- Enable RLS on tables
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

-- Create policy for matchmaking_queue
DROP POLICY IF EXISTS "Users can manage their own queue entries" ON public.matchmaking_queue;
CREATE POLICY "Users can manage their own queue entries" 
ON public.matchmaking_queue 
FOR ALL 
USING (user_id = auth.uid());

-- Enable realtime for better WebSocket connections
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;

-- Set replica identity for proper realtime updates
ALTER TABLE public.matchmaking_queue REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.game_players REPLICA IDENTITY FULL;
