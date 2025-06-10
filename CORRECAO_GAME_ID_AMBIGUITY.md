# Correção do Erro "column reference game_id is ambiguous"

## Problema Identificado
O erro `column reference "game_id" is ambiguous` está sendo causado quando usuários tentam entrar na fila de matchmaking. Este erro indica que há uma referência ambígua à coluna `game_id` em alguma função do banco de dados.

## Causa Raiz
O problema está na função `play_highest_piece` que foi criada sem usar um parâmetro adequadamente nomeado, causando ambiguidade com colunas de tabela.

## Correções Aplicadas

### 1. Frontend (MatchmakingQueue.tsx)
✅ **CORRIGIDO** - Removida a chamada para edge function inexistente `play-highest-piece`

```tsx
// ANTES (PROBLEMÁTICO):
const { error: playError } = await supabase.functions.invoke('play-highest-piece', {
  body: { gameId },
});

// DEPOIS (CORRIGIDO):
// A primeira peça será jogada automaticamente pelo trigger do banco
console.log('Jogo criado, ID:', gameId);
console.log('A primeira peça será jogada automaticamente pelo trigger do banco.');
```

### 2. Backend - Função do Banco
Execute o script `fix_game_id_ambiguity.sql` no painel do Supabase para corrigir a função:

```sql
-- Função corrigida com parâmetro adequadamente nomeado
CREATE OR REPLACE FUNCTION play_highest_piece(p_game_id uuid)
RETURNS void AS $$
-- ... (código corrigido)
```

## Como Executar as Correções

### Passo 1: Aplicar correção no banco
1. Acesse o painel do Supabase
2. Vá em SQL Editor  
3. Execute o conteúdo completo do arquivo `fix_game_id_ambiguity.sql`

### Passo 2: Verificar se funcionou
1. Teste entrar na fila de matchmaking
2. O erro 400 "game_id is ambiguous" deve desaparecer
3. A criação de jogos deve funcionar normalmente

## Problemas Corrigidos

### ❌ Problema Original:
```
POST /rest/v1/matchmaking_queue 400 (Bad Request)
{code: '42702', message: 'column reference "game_id" is ambiguous'}
```

### ✅ Resultado Esperado:
- Entrada na fila funcionando sem erros
- Criação de jogos funcionando 
- Primeira peça jogada automaticamente pelo trigger

## Status
- ✅ Frontend corrigido
- 🔄 Backend: Execute `fix_game_id_ambiguity.sql` 
- 🔄 Teste: Verificar funcionamento

## Arquivos Modificados
- `src/components/MatchmakingQueue.tsx` - Removida chamada para edge function
- `fix_game_id_ambiguity.sql` - Script de correção do banco

## Próximos Passos
1. Execute o script SQL no painel do Supabase
2. Teste a funcionalidade de matchmaking
3. Verifique se a primeira peça é jogada automaticamente 