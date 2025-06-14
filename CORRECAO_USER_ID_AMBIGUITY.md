# Correção do Erro "column reference user_id is ambiguous"

## Problema Identificado
Após corrigir o erro da coluna `idjogopleiteado`, agora enfrentamos um novo erro:
```
column reference "user_id" is ambiguous
code: "42702"
details: "It could refer to either a PL/pgSQL variable or a table column."
```

## Causa Raiz
Este erro indica que há uma ambiguidade na referência à coluna `user_id` em:
- Políticas RLS (Row Level Security)
- Triggers ou funções do banco de dados
- Subconsultas que não usam aliases adequados

## Soluções Propostas

### Solução 1: Desabilitar RLS Temporariamente (Para Testes)
Execute o script `disable_rls_temporarily.sql` no painel do Supabase:

```sql
-- APENAS PARA TESTES - Desabilitar RLS
ALTER TABLE matchmaking_queue DISABLE ROW LEVEL SECURITY;
```

**⚠️ IMPORTANTE**: Esta é uma solução temporária apenas para testes. O RLS deve ser reabilitado em produção.

### Solução 2: Corrigir Políticas RLS (Recomendado)
Execute o script `fix_user_id_ambiguity.sql` no painel do Supabase para:
1. Identificar políticas problemáticas
2. Recriar políticas com aliases adequados
3. Verificar triggers que podem causar ambiguidade

### Solução 3: Verificar e Corrigir Triggers
O script também verifica se há triggers na tabela `matchmaking_queue` que podem estar causando a ambiguidade.

## Como Executar as Correções

### Passo 1: Diagnóstico
1. Acesse o painel do Supabase
2. Vá em SQL Editor
3. Execute o script `fix_user_id_ambiguity.sql` (apenas as queries SELECT iniciais)
4. Analise os resultados para identificar a causa

### Passo 2: Correção Temporária (Para Testes Imediatos)
```sql
ALTER TABLE matchmaking_queue DISABLE ROW LEVEL SECURITY;
```

### Passo 3: Teste a Funcionalidade
1. Teste entrar na fila de matchmaking
2. Verifique se o erro desapareceu
3. Teste com 4 jogadores

### Passo 4: Correção Definitiva
Execute as correções de políticas RLS do script `fix_user_id_ambiguity.sql`:
```sql
-- Recriar políticas com aliases adequados
DROP POLICY IF EXISTS "Users can see queue" ON matchmaking_queue;
DROP POLICY IF EXISTS "Users can manage own queue entry" ON matchmaking_queue;

CREATE POLICY "Users can see queue" ON matchmaking_queue 
FOR SELECT TO authenticated;

CREATE POLICY "Users can manage own queue entry" ON matchmaking_queue 
FOR ALL USING (auth.uid() = matchmaking_queue.user_id);

ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;
```

## Problemas Corrigidos

### ❌ Problema Original:
```
POST /rest/v1/matchmaking_queue 400 (Bad Request)
{code: '42702', message: 'column reference "user_id" is ambiguous'}
```

### ✅ Resultado Esperado:
- Entrada na fila funcionando sem erros de ambiguidade
- Políticas RLS funcionando corretamente
- Sistema de matchmaking operacional

## Status Atual
- [x] Identificado o problema de ambiguidade de `user_id`
- [x] Criados scripts de diagnóstico e correção
- [ ] Executar correções no banco de dados
- [ ] Testar funcionalidade
- [ ] Reabilitar RLS com políticas corrigidas

## Próximos Passos
1. Execute o script de diagnóstico
2. Aplique a correção temporária para testes
3. Teste a funcionalidade
4. Aplique a correção definitiva das políticas RLS
5. Documente os resultados 