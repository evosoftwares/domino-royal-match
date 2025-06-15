
-- Habilitar Realtime para tabela solicitacoes
ALTER TABLE public.solicitacoes REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes;
