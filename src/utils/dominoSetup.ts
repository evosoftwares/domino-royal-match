
import { Piece } from '@/types/game';

// A peça de dominó é representada como um objeto com lados 'l' e 'r'.
export interface DominoPiece {
  l: number;
  r: number;
}

/**
 * Gera um baralho padrão de 28 peças de dominó.
 */
export const generateDeck = (): DominoPiece[] => {
  const pieces: DominoPiece[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      pieces.push({ l: i, r: j });
    }
  }
  return pieces;
};

/**
 * Embaralha um array de forma aleatória.
 * @param deck O array a ser embaralhado.
 * @returns Um novo array embaralhado.
 */
export const shuffleDeck = <T>(deck: T[]): T[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Distribui 4 mãos de 6 peças de um baralho embaralhado.
 * @param deck O baralho de onde tirar as peças.
 * @returns Um array com 4 mãos.
 */
export const dealHands = (deck: DominoPiece[]): DominoPiece[][] => {
  const hands: DominoPiece[][] = [];
  for (let i = 0; i < 4; i++) {
    hands.push(deck.slice(i * 6, (i + 1) * 6));
  }
  return hands;
};

export interface StartingPlayerInfo {
  playerIndex: number;
  startingPiece: DominoPiece;
  newHand: DominoPiece[];
}

/**
 * Encontra o jogador inicial baseado na maior peça dupla (carroça) ou na maior soma.
 * @param hands As mãos de todos os jogadores.
 * @returns Informações sobre o jogador inicial e sua mão atualizada.
 */
export const findStartingPlayer = (hands: DominoPiece[][]): StartingPlayerInfo | null => {
  let bestPiece: DominoPiece | null = null;
  let bestPieceValue = -1;
  let startingPlayerIndex = -1;

  hands.forEach((hand, playerIndex) => {
    hand.forEach(piece => {
      let value = piece.l + piece.r;
      // Peças duplas (carroças) recebem um bônus para serem escolhidas primeiro.
      if (piece.l === piece.r) {
        value += 100; // Ex: 6-6 vale 112, enquanto 6-5 vale 11.
      }

      if (value > bestPieceValue) {
        bestPieceValue = value;
        bestPiece = piece;
        startingPlayerIndex = playerIndex;
      }
    });
  });

  if (!bestPiece || startingPlayerIndex === -1) {
    return null;
  }

  // Remove a peça inicial da mão do jogador.
  const startingPlayerHand = hands[startingPlayerIndex];
  const newHand = startingPlayerHand.filter(p => !(p.l === bestPiece!.l && p.r === bestPiece!.r));

  return {
    playerIndex: startingPlayerIndex,
    startingPiece: bestPiece,
    newHand,
  };
};
