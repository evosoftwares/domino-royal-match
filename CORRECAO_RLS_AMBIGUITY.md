# Correção do Erro "column reference user_id is ambiguous"

## 🚨 Problema Identificado

Quando o quarto jogador tenta entrar na fila de matchmaking, o sistema retorna o erro:
```
column reference "user_id" is ambiguous
```

## 🔍 Causa Raiz

O erro é causado por políticas RLS (Row Level Security) mal definidas no Supabase. Especificamente, a política `"Players can see game players"` na tabela `game_players` contém uma subconsulta que referencia a mesma tabela sem usar aliases, causando ambiguidade:

```sql
-- PROBLEMÁTICO:
CREATE POLICY "Players can see game players" ON game_players FOR SELECT USING (
    game_id IN (SELECT game_id FROM game_players WHERE user_id = auth.uid())
);
```

Nesta consulta, há duas referências à tabela `game_players`:
1. A tabela principal da política
2. A tabela na subconsulta

Ambas têm a coluna `user_id`, e o PostgreSQL não consegue determinar qual usar.

## ✅ Solução Implementada

### Passo 1: Executar o Script de Correção

Execute o arquivo `fix_rls_ambiguity.sql` no painel SQL do Supabase:

1. Acesse o painel do Supabase
2. Vá em **SQL Editor**
3. Cole e execute o conteúdo do arquivo `fix_rls_ambiguity.sql`

### Passo 2: Políticas Corrigidas

As políticas foram reescritas usando aliases para evitar ambiguidade:

```sql
-- CORRIGIDO:
CREATE POLICY "Players can see game players" ON game_players FOR SELECT USING (
    game_id IN (
        SELECT gp.game_id 
        FROM game_players gp 
        WHERE gp.user_id = auth.uid()
    )
);
```

### Passo 3: Políticas Adicionais

Foram adicionadas políticas para INSERT e UPDATE que estavam faltando:

```sql
CREATE POLICY "Players can insert into game_players" ON game_players FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Players can update own game_players" ON game_players FOR UPDATE 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());
```

## 🧪 Como Testar

Após executar o script:

1. Tente entrar na fila de matchmaking como o quarto jogador
2. O erro "user_id is ambiguous" deve desaparecer
3. A fila deve funcionar normalmente para todos os 4 jogadores

## 📝 Arquivos Modificados

- `fix_rls_ambiguity.sql` - Script de correção
- `CORRECAO_RLS_AMBIGUITY.md` - Esta documentação

## 🔧 Comandos de Verificação

Para verificar se as políticas estão corretas:

```sql
-- Listar todas as políticas da tabela game_players
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'game_players';

-- Testar se a consulta funciona sem ambiguidade
SELECT * FROM game_players WHERE user_id = auth.uid();
```

## ⚠️ Importante

- Execute o script apenas uma vez
- Teste em ambiente de desenvolvimento primeiro
- Faça backup das políticas existentes se necessário
- Monitore os logs após a aplicação 