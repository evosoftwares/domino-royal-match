
-- Adicionar a coluna updated_at à tabela game_players para o versionamento
ALTER TABLE public.game_players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Criar um trigger para atualizar automaticamente o 'updated_at' na modificação da linha
-- A função update_updated_at_column já existe, então apenas criamos o trigger
DROP TRIGGER IF EXISTS handle_updated_at_game_players ON public.game_players; -- Evita duplicatas
CREATE TRIGGER handle_updated_at_game_players
BEFORE UPDATE ON public.game_players
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS (Row Level Security) em ambas as tabelas para proteger os dados
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- Política para a tabela 'games':
-- Permitir que jogadores vejam os jogos dos quais fazem parte
CREATE POLICY "Users can view games they are in"
ON public.games FOR SELECT
USING (
  id IN (
    SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
  )
);

-- Permitir que o jogador do turno atual atualize o jogo
-- Esta política será usada pelo nosso sistema de locking otimista
CREATE POLICY "Current player can update the game"
ON public.games FOR UPDATE
USING (auth.uid() = current_player_turn);


-- Política para a tabela 'game_players':
-- Permitir que jogadores vejam todos os jogadores no mesmo jogo
CREATE POLICY "Users can view players in their games"
ON public.game_players FOR SELECT
USING (
  game_id IN (
    SELECT game_id FROM public.game_players WHERE user_id = auth.uid()
  )
);

-- Permitir que um jogador atualize seus próprios dados (ex: mão de peças)
CREATE POLICY "Users can update their own player data"
ON public.game_players FOR UPDATE
USING (auth.uid() = user_id);
