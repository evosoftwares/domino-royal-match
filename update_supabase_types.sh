#!/bin/bash

# Script para atualizar os tipos TypeScript do Supabase

echo "🔄 Atualizando tipos TypeScript do Supabase..."

# Gera os tipos TypeScript
npx supabase gen types typescript --project-id eogpablvlwejutlmiyir > src/integrations/supabase/types.ts

echo "✅ Tipos TypeScript atualizados!"

# Opcional: formatar o arquivo gerado
if command -v prettier &> /dev/null; then
    prettier --write src/integrations/supabase/types.ts
    echo "✅ Arquivo formatado com Prettier!"
fi

echo "🎉 Processo concluído!" 