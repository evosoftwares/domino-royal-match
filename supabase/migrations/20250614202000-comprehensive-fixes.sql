
-- ETAPA 1: REMOVER POLÍTICAS PERIGOSAS "ALLOW ALL"
DROP POLICY IF EXISTS "Allow all for game_players" ON public.game_players;
DROP POLICY IF EXISTS "Allow all for games" ON public.games;

-- ETAPA 2: CRIAR POLÍTICAS RLS SEGURAS E ESPECÍFICAS
-- Política para game_players: usuários podem ver jogadores nos seus jogos
CREATE POLICY "Users can view players in their games" 
ON public.game_players FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp2 
    WHERE gp2.game_id = game_players.game_id 
    AND gp2.user_id = auth.uid()
  )
);

-- Política para game_players: usuários podem atualizar apenas seus próprios dados
CREATE POLICY "Users can update their own player data" 
ON public.game_players FOR UPDATE
USING (auth.uid() = user_id);

-- Política para game_players: sistema pode inserir jogadores
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

-- Política para games: sistema pode inserir jogos
CREATE POLICY "System can insert games" 
ON public.games FOR INSERT
WITH CHECK (true);

-- ETAPA 3: CRIAR FUNÇÃO PARA PREVENÇÃO DE RACE CONDITIONS
CREATE OR REPLACE FUNCTION public.safe_create_game_when_ready()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    target_game_id bigint;
    queue_users uuid[];
    new_game_id uuid;
    game_creation_lock text;
    is_locked boolean := false;
BEGIN
    -- Criar lock para prevenir race conditions
    game_creation_lock := 'game_creation_lock_' || 1; -- Para dominó
    
    -- Tentar adquirir lock
    BEGIN
        PERFORM pg_advisory_xact_lock(hashtext(game_creation_lock));
        is_locked := true;
        RAISE NOTICE '🔒 Lock adquirido para criação de jogo';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Não foi possível adquirir lock';
            RETURN jsonb_build_object('success', false, 'error', 'Game creation in progress');
    END;
    
    -- Verificar novamente se há jogadores suficientes após o lock
    SELECT idjogopleiteado INTO target_game_id
    FROM matchmaking_queue 
    WHERE status = 'searching' 
    GROUP BY idjogopleiteado 
    HAVING COUNT(*) >= 4 
    LIMIT 1;
    
    IF target_game_id IS NULL THEN
        RAISE NOTICE '❌ Não há jogadores suficientes após lock';
        RETURN jsonb_build_object('success', false, 'error', 'Not enough players after lock');
    END IF;
    
    -- Verificar se já existe um jogo recente para evitar duplicatas
    IF EXISTS (
        SELECT 1 FROM games g
        JOIN game_players gp ON g.id = gp.game_id
        WHERE g.status = 'active' 
        AND g.created_at > NOW() - INTERVAL '30 seconds'
        AND gp.user_id IN (
            SELECT user_id FROM matchmaking_queue 
            WHERE status = 'searching' AND idjogopleiteado = target_game_id
            LIMIT 4
        )
    ) THEN
        RAISE NOTICE '⚠️ Jogo recente já existe para estes jogadores';
        RETURN jsonb_build_object('success', false, 'error', 'Recent game already exists');
    END IF;
    
    -- Chamar a função original de criação
    RETURN create_game_when_ready();
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ ERRO na criação segura: %', SQLERRM;
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- ETAPA 4: ATUALIZAR TRIGGER PARA USAR FUNÇÃO SEGURA
CREATE OR REPLACE FUNCTION public.safe_auto_create_game_on_queue_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    queue_count integer;
    result jsonb;
    last_trigger_time timestamp;
BEGIN
    -- Debounce: verificar se não houve trigger recente
    SELECT EXTRACT(EPOCH FROM (NOW() - created_at))::integer INTO last_trigger_time
    FROM matchmaking_queue 
    WHERE status = 'searching' 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Se o último trigger foi há menos de 2 segundos, ignorar
    IF last_trigger_time IS NOT NULL AND last_trigger_time < 2 THEN
        RAISE NOTICE '⏱️ Debounce ativo, ignorando trigger';
        RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Contar jogadores na fila
    SELECT COUNT(*) INTO queue_count
    FROM matchmaking_queue 
    WHERE status = 'searching' AND idjogopleiteado = 1;
    
    RAISE NOTICE '📊 Jogadores na fila: %', queue_count;
    
    -- Se há 4 ou mais jogadores, tentar criar jogo
    IF queue_count >= 4 THEN
        RAISE NOTICE '🎯 Tentando criar jogo com função segura...';
        SELECT safe_create_game_when_ready() INTO result;
        RAISE NOTICE '📝 Resultado: %', result;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ETAPA 5: RECRIAR TRIGGER COM FUNÇÃO SEGURA
DROP TRIGGER IF EXISTS auto_create_game_trigger ON matchmaking_queue;
CREATE TRIGGER auto_create_game_trigger
    AFTER INSERT OR UPDATE ON matchmaking_queue
    FOR EACH ROW
    EXECUTE FUNCTION safe_auto_create_game_on_queue_change();
