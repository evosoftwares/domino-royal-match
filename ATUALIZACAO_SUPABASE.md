# 🚀 Atualização do Supabase - Correção da Primeira Jogada

## ⚠️ Problema Identificado

A primeira peça não estava sendo jogada automaticamente quando o jogo iniciava. Era necessário implementar a lógica para jogar automaticamente a peça de maior valor na primeira jogada.

## 🔧 Solução Implementada

### 1. Função `play_highest_piece()`
- Encontra a peça de maior valor entre todos os jogadores
- Joga automaticamente esta peça no tabuleiro
- Remove a peça da mão do jogador
- Define o próximo jogador na sequência

### 2. Trigger `play_highest_piece_trigger`
- Executa automaticamente quando um jogo novo é criado
- Apenas se o jogo estiver ativo e o tabuleiro vazio

## 📋 Como Aplicar as Correções

### Opção 1: Via Painel do Supabase (RECOMENDADO)

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Vá para seu projeto: `eogpablvlwejutlmiyir`
3. Entre na seção **SQL Editor**
4. Copie e cole todo o conteúdo do arquivo `supabase_manual_migration.sql`
5. Execute o script clicando em **Run**

### Opção 2: Via CLI (quando houver espaço em disco)

```bash
# Limpe o cache do npm primeiro
npm cache clean --force

# Execute o script de atualização
./update_supabase_types.sh

# Ou execute manualmente:
npx supabase gen types typescript --project-id eogpablvlwejutlmiyir > src/integrations/supabase/types.ts
```

## 🧪 Como Testar

Após aplicar a migração:

1. **Crie um novo jogo** através do sistema de matchmaking
2. **Observe que automaticamente** a primeira peça (de maior valor) será colocada no tabuleiro
3. **O jogo iniciará** já com uma peça no tabuleiro e definirá o próximo jogador

## 📁 Arquivos Criados/Modificados

- `supabase/migrations/001_add_first_play_trigger.sql` - Migração original
- `supabase_manual_migration.sql` - Script para execução manual
- `update_supabase_types.sh` - Script para atualizar tipos TypeScript
- `ATUALIZACAO_SUPABASE.md` - Este arquivo de instruções

## 🔍 Verificação da Implementação

Após executar o script SQL, você pode verificar se tudo foi aplicado corretamente:

```sql
-- Verificar se as funções foram criadas
SELECT proname FROM pg_proc WHERE proname IN ('play_highest_piece', 'trigger_play_highest_piece');

-- Verificar se o trigger foi criado
SELECT tgname FROM pg_trigger WHERE tgname = 'play_highest_piece_trigger';
```

## 🎯 Resultado Esperado

- ✅ Primeira peça jogada automaticamente ao iniciar o jogo
- ✅ Peça de maior valor é selecionada entre todos os jogadores
- ✅ Tabuleiro inicializado com a primeira peça
- ✅ Turno definido para o próximo jogador
- ✅ Estado do jogo atualizado corretamente

## 🚨 Problemas de Espaço em Disco

Se você encontrar erros de "no space left on device":

1. Limpe caches: `npm cache clean --force`
2. Remova node_modules desnecessários
3. Execute: `docker system prune` para limpar Docker
4. Use a **Opção 1** (via painel) que não requer CLI local

## 📞 Suporte

Se houver problemas na implementação, verifique:
- Se o projeto Supabase está ativo
- Se as tabelas `games` e `game_players` existem
- Se os tipos de dados estão corretos (UUID para IDs, JSONB para hands)

---

**Status:** ✅ Implementação completa - pronta para aplicação 