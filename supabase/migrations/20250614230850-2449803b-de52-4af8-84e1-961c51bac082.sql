
-- Recria o gatilho (trigger) que inicia a criação de jogos automaticamente.
-- Este gatilho é essencial para que o sistema de matchmaking funcione corretamente.
CREATE TRIGGER auto_create_game_on_queue_change_trigger
AFTER INSERT OR UPDATE ON public.matchmaking_queue
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_game_on_queue_change();
