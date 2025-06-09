# Sistema de Drag and Drop - Dominó Royal Match

## Análise dos Arquivos Existentes

### Estrutura Atual Aproveitada:
- **Design das peças**: Mantido integralmente no `DominoPiece.tsx` com os pontos (dots) e gradientes existentes
- **Distribuição das peças**: Layout elegante do `PlayerHand.tsx` preservado com grid responsivo
- **Tabuleiro**: `GameBoard.tsx` mantém o visual de mesa verde com bordas tracejadas
- **Tipos**: Estruturas `DominoPieceType` e `PlayerData` reutilizadas
- **Lógica de validação**: Funções `canPiecePlay` e `determineSide` preservadas

## Dependências Instaladas

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Versões instaladas:**
- `@dnd-kit/core`: Sistema principal de drag and drop
- `@dnd-kit/sortable`: Utilitários para ordenação (usado para teclado)
- `@dnd-kit/utilities`: Funções auxiliares

## Comportamentos Específicos Implementados

### Feedback Visual
- **Durante o arraste**: Peça original fica com `opacity: 0.5` e `scale-105`
- **Hover states**: Transições suaves de 200ms com `hover:ring-2 hover:ring-purple-400`
- **Drop zone ativa**: Borda `border-purple-400` tracejada com `bg-purple-400/10`
- **Overlay de arraste**: Peça fantasma com `rotate-6 shadow-2xl`

### Animações
- **Transições**: `transition-all duration-200` para hover/drag states
- **Escalas suaves**: `scale-[1.02]` para feedback de drop zone
- **Rotação no overlay**: `rotate-6` para indicar movimento
- **Pulse animation**: Indicadores de extremidades do tabuleiro

### Responsividade
- **Touch devices**: Sensores configurados com `PointerSensor` para mobile/tablet
- **Distância de ativação**: 8px para evitar ativação acidental
- **Layout adaptativo**: Grid responsivo mantido (`grid-cols-7`)

### Acessibilidade
- **Atributos ARIA**: `aria-label`, `aria-pressed`, `aria-disabled`
- **Navegação por teclado**: `KeyboardSensor` configurado
- **Focus states**: `tabIndex` apropriado para peças jogáveis
- **Screen readers**: Labels descritivos para valores das peças

## Validação e Estados de Erro

### Validação Implementada
- **Jogadas inválidas**: Toast de erro + peça retorna à posição original
- **Vez do jogador**: Verificação antes de permitir drag
- **Drop zones indisponíveis**: Feedback visual desabilitado quando não é a vez
- **Processamento**: Drag desabilitado durante `isProcessingMove`

### Casos Tratados
- **Drop fora do tabuleiro**: Toast "Solte a peça no tabuleiro para jogar"
- **Peça não conectável**: Toast "Essa peça não pode ser jogada"
- **Turno incorreto**: Toast "Não é a sua vez de jogar"
- **Processamento pendente**: Toast "Aguarde, processando jogada anterior"

## Interfaces TypeScript

### PlayerHandProps (Nova)
```typescript
interface PlayerHandProps {
  dominoes: DominoPieceType[];
  onPlayDomino: (domino: DominoPieceType) => void;
  disabled?: boolean;
}
```

### DominoPieceProps (Atualizada)
```typescript
interface DominoPieceProps {
  topValue: number;
  bottomValue: number;
  isDragging?: boolean;
  isPlayable?: boolean;
  onClick?: () => void;
  className?: string;
  orientation?: 'vertical' | 'horizontal';
  id?: string;
  enableDrag?: boolean;
}
```

### DragEndEvent (Nova)
```typescript
interface DragEndEvent {
  active: {
    id: string;
    data: {
      current: {
        topValue: number;
        bottomValue: number;
        id: string;
      };
    };
  };
  over?: {
    id: string;
    data: {
      current: {
        type: string;
      };
    };
  } | null;
}
```

## Tema Visual Implementado

### Cores Principais
- **Cor primária**: `purple-600` (#9333ea) - aplicada em hovers e rings
- **Background escuro**: `gray-900` (#111827) - mantido do design original
- **Hover states**: `purple-500` com transição suave de 200ms
- **Drop zone ativa**: `border-purple-400` tracejada com `bg-purple-400/10`

### Estados Visuais
- **Drag ativo**: `opacity-50 scale-105 z-50`
- **Hover**: `ring-2 ring-purple-400`
- **Disabled**: `opacity-60 cursor-not-allowed grayscale`
- **Drop zone**: `scale-[1.02] shadow-lg shadow-purple-400/20`

## Configuração do DndContext

```typescript
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // Requer movimento de 8px para ativar
    },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

<DndContext
  sensors={sensors}
  collisionDetection={closestCorners}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
```

## Critérios de Sucesso - ✅ Implementados

- [x] **Peças arrastam suavemente sem lag**: Sensores otimizados e transforms CSS
- [x] **Feedback visual claro**: Opacity, scale, rings e cores implementadas
- [x] **Código TypeScript sem erros**: Todas as interfaces tipadas corretamente
- [x] **Componentes reutilizáveis**: DominoPiece e PlayerHand modulares
- [x] **Funciona em desktop e mobile**: Sensores responsivos configurados

## Componentes Atualizados

### 1. DominoPiece.tsx
- Removido drag nativo (`onDragStart`, `onDragEnd`)
- Adicionado hook `useDraggable` do @dnd-kit
- Novos props: `id`, `enableDrag`
- Acessibilidade aprimorada com ARIA
- Feedback visual aprimorado

### 2. GameBoard.tsx
- Removido handlers de drag nativo
- Adicionado hook `useDroppable`
- Feedback visual durante drag over
- Prop `isDropAllowed` para controle de estado

### 3. PlayerHand.tsx
- Removida lógica de drag nativo
- Simplificado para usar `enableDrag` do DominoPiece
- Removido prop `onPieceDrag`
- Mantido layout responsivo

### 4. Game2Room.tsx
- Adicionado `DndContext` como wrapper principal
- Configuração de sensores responsivos
- `DragOverlay` para feedback visual
- Handlers `handleDragStart` e `handleDragEnd`
- Removida lógica de drag nativo

## Não Implementado (Conforme Solicitado)

- ❌ **Lógica de validação de jogadas**: Mantida no componente pai
- ❌ **Persistência de estado**: Gerenciada externamente via Supabase
- ❌ **Rotação automática de peças**: Não implementada (fora do escopo)

## Performance e Otimizações

### Otimizações Implementadas
- **React.memo**: Game2Room envolvido para evitar re-renders
- **useCallback**: Funções de validação memoizadas
- **Transform CSS**: Uso de `translate3d` para performance
- **Sensores otimizados**: Distância mínima para ativação
- **Z-index específico**: Apenas durante drag (`z-50`)

### Detecção de Colisão
- **Algoritmo**: `closestCorners` para precisão
- **Áreas válidas**: Apenas `game-board` como drop zone
- **Feedback imediato**: Visual update durante hover

Esta implementação mantém toda a elegância visual existente while adding robust drag and drop functionality with modern best practices para acessibilidade, performance e experiência do usuário.