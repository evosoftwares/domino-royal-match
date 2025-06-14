
-- ETAPA 1: LIMPAR TODAS AS POLÍTICAS RLS DUPLICADAS E CONFLITANTES
-- Remover políticas das tabelas game_players
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
DROP POLICY IF EXISTS "Users can view players in their games" ON public.game_players;
DROP POLICY IF EXISTS "Users can update their own player data" ON public.game_players;
DROP POLICY IF EXISTS "Users can view game players for their games" ON public.game_players;

-- Remover políticas das tabelas games
DROP POLICY IF EXISTS "Users can view games they participate in" ON public.games;
DROP POLICY IF EXISTS "Users can view their games" ON public.games;
DROP POLICY IF EXISTS "Players can view their games" ON public.games;
DROP POLICY IF EXISTS "Users can view games where they are players" ON public.games;
DROP POLICY IF EXISTS "System can insert games" ON public.games;
DROP POLICY IF EXISTS "System can update games" ON public.games;
DROP POLICY IF EXISTS "Current player can update game" ON public.games;
DROP POLICY IF EXISTS "Allow all for games" ON public.games;
DROP POLICY IF EXISTS "Allow all for game_players" ON public.game_players;

-- ETAPA 2: CRIAR APENAS AS POLÍTICAS RLS ESSENCIAIS E FUNCIONAIS
-- Políticas para game_players (3 políticas essenciais)
CREATE POLICY "Players can view games they participate in" 
ON public.game_players FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp2 
    WHERE gp2.game_id = game_players.game_id 
    AND gp2.user_id = auth.uid()
  )
);

CREATE POLICY "Players can update their own data" 
ON public.game_players FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can create players" 
ON public.game_players FOR INSERT
WITH CHECK (true);

-- Políticas para games (3 políticas essenciais)
CREATE POLICY "Players can view their active games" 
ON public.games FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp 
    WHERE gp.game_id = games.id 
    AND gp.user_id = auth.uid()
  )
);

CREATE POLICY "Current player can update game state" 
ON public.games FOR UPDATE
USING (auth.uid() = current_player_turn);

CREATE POLICY "System can create games" 
ON public.games FOR INSERT
WITH CHECK (true);

-- ETAPA 3: VERIFICAR E RECRIAR O TRIGGER CRÍTICO
-- Remover triggers existentes para evitar conflitos
DROP TRIGGER IF EXISTS auto_create_game_trigger ON public.matchmaking_queue;
DROP TRIGGER IF EXISTS trigger_auto_create_game ON public.matchmaking_queue;

-- Recriar a função do trigger com logs detalhados
CREATE OR REPLACE FUNCTION public.auto_create_game_on_queue_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    queue_count integer;
    result jsonb;
BEGIN
    RAISE NOTICE '🔥 TRIGGER EXECUTADO: Evento=%, User=%, Status=%', 
        TG_OP, 
        COALESCE(NEW.user_id, OLD.user_id),
        COALESCE(NEW.status, OLD.status);
    
    -- Contar jogadores na fila para dominó (idjogopleiteado = 1)
    SELECT COUNT(*) INTO queue_count
    FROM matchmaking_queue 
    WHERE status = 'searching' AND idjogopleiteado = 1;
    
    RAISE NOTICE '📊 Jogadores na fila após trigger: %', queue_count;
    
    -- Se há 4 ou mais jogadores, tentar criar jogo
    IF queue_count >= 4 THEN
        RAISE NOTICE '🎯 ATIVANDO CRIAÇÃO DE JOGO - 4+ jogadores detectados!';
        
        -- Chamar função segura de criação
        SELECT safe_create_game_when_ready() INTO result;
        
        RAISE NOTICE '✅ Resultado da criação: %', result;
    ELSE
        RAISE NOTICE '⏳ Aguardando mais jogadores (%/4)', queue_count;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recriar o trigger COM LOGS DETALHADOS
CREATE TRIGGER auto_create_game_trigger
    AFTER INSERT OR UPDATE ON public.matchmaking_queue
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_game_on_queue_change();

-- ETAPA 4: VERIFICAR CONFIGURAÇÃO REALTIME
-- Garantir que as tabelas tenham realtime ativo
ALTER TABLE public.matchmaking_queue REPLICA IDENTITY FULL;
ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER TABLE public.game_players REPLICA IDENTITY FULL;

-- Adicionar às publicações realtime se ainda não estiverem
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'matchmaking_queue'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'games'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'game_players'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
    END IF;
END $$;
