# 🔍 Investigação: Por que a primeira peça não está sendo jogada

## 🚨 **Problemas Identificados**

### 1. **Edge Function Inexistente**
- ❌ O código em `useMatchmaking.ts` chama `supabase.functions.invoke('play-highest-piece')` 
- ❌ Esta edge function **NÃO EXISTE** no projeto
- ❌ Causando erro 404 e falha na jogada automática

### 2. **Trigger Pode Não Estar Aplicado**
- ❌ O trigger `play_highest_piece_trigger` pode não ter sido aplicado no banco
- ❌ Mesmo que esteja aplicado, pode ter bugs na lógica

### 3. **Lógica de Próximo Jogador Incorreta**
- ❌ A fórmula para calcular o próximo jogador estava errada
- ❌ Poderia falhar em jogos com diferentes números de jogadores

## ✅ **Soluções Implementadas**

### 1. **Código Frontend Corrigido**
- ✅ Removida chamada para edge function inexistente em `useMatchmaking.ts`
- ✅ O código agora confia apenas no trigger do banco
- ✅ Mensagens de sucesso atualizadas

### 2. **Trigger Melhorado**
- ✅ Criado `fix_trigger.sql` com versão corrigida
- ✅ Adicionados logs detalhados (RAISE NOTICE) para debug
- ✅ Lógica de próximo jogador corrigida
- ✅ Melhor tratamento de diferentes formatos de peças

### 3. **Scripts de Teste e Verificação**
- ✅ `test_trigger.sql` - Para verificar se o trigger existe e funciona
- ✅ `fix_trigger.sql` - Versão corrigida do trigger com logs
- ✅ Scripts para diagnosticar problemas no banco

## 📋 **Passos para Resolver**

### Passo 1: Verificar o Estado Atual
Execute `test_trigger.sql` no painel do Supabase para verificar:
- Se as funções existem
- Se o trigger está ativo
- Estado dos jogos existentes

### Passo 2: Aplicar as Correções
1. Execute `fix_trigger.sql` no painel do Supabase
2. Isso criará/atualizará as funções com logs detalhados
3. Recriará o trigger

### Passo 3: Testar
1. Crie um novo jogo através do matchmaking
2. Verifique os logs no Supabase (seção "Logs")
3. Confirme se a primeira peça foi jogada automaticamente

## 🔧 **Como Funciona Agora**

### Fluxo Correto:
1. **Matchmaking** → 4 jogadores na fila
2. **start-game** → Edge function cria o jogo com status 'active'
3. **TRIGGER** → Detecta jogo novo com status 'active' e tabuleiro vazio
4. **play_highest_piece()** → Encontra e joga a peça de maior valor
5. **Estado Atualizado** → Tabuleiro, próximo jogador, mãos atualizadas
6. **Frontend** → Recebe atualizações via Realtime

### Logs de Debug:
- `RAISE NOTICE` mostra cada passo no console do Supabase
- Permite identificar exatamente onde algo falha

## 📁 **Arquivos Criados/Modificados**

### Novos:
- `test_trigger.sql` - Script de diagnóstico
- `fix_trigger.sql` - Trigger corrigido com logs
- `INVESTIGACAO_PRIMEIRA_PECA.md` - Este relatório

### Modificados:
- `src/hooks/useMatchmaking.ts` - Removida chamada de edge function inexistente

## 🚀 **Próximos Passos**

1. **Execute `fix_trigger.sql`** no painel do Supabase
2. **Teste criando um jogo** via matchmaking
3. **Verifique os logs** na seção Logs do Supabase
4. **Se ainda não funcionar**, execute `test_trigger.sql` para diagnóstico

## 🔍 **Como Debuggar**

### Ver Logs do Trigger:
1. Acesse Supabase Dashboard
2. Vá em "Logs" → "Database"
3. Filtre por "NOTICE" para ver os logs da função

### Testar Manualmente:
```sql
-- Substitua 'SEU-GAME-ID' por um ID real de jogo
SELECT play_highest_piece('SEU-GAME-ID');
```

### Verificar Estrutura:
```sql
-- Ver jogos ativos sem peças no tabuleiro
SELECT id, status, board_state 
FROM games 
WHERE status = 'active' 
AND (board_state IS NULL OR jsonb_array_length(board_state->'pieces') = 0);
```

## ⚠️ **Pontos de Atenção**

1. **Formatos de Peças**: A função suporta `{l: number, r: number}` e `[number, number]`
2. **Posições dos Jogadores**: Devem ser sequenciais (1, 2, 3, 4)
3. **Status do Jogo**: Trigger só funciona com status 'active'
4. **Edge Functions**: Certifique-se que `start-game` existe no banco remoto

---

**Status da Investigação:** ✅ **COMPLETA** - Problemas identificados e soluções implementadas 