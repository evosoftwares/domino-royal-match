
import { DominoPieceType } from '@/types/game';

export interface PieceConnection {
  piece: DominoPieceType;
  index: number;
  leftConnection: number | null;
  rightConnection: number | null;
  orientation: 'vertical' | 'horizontal';
  position: { x: number; y: number };
  isFlipped: boolean;
  isDupla: boolean; // Nova propriedade para identificar peças duplas
}

export interface BoardEnds {
  leftEnd: number | null;
  rightEnd: number | null;
  leftPieceIndex: number | null;
  rightPieceIndex: number | null;
}

/**
 * Calcula a orientação correta de uma peça baseada nos valores
 * Regra: Peças duplas (valores iguais) ficam verticais (cruzadas), outras ficam horizontais
 */
export const calculatePieceOrientation = (
  piece: DominoPieceType,
  index: number,
  pieces: DominoPieceType[],
  connectionValue?: number
): 'vertical' | 'horizontal' => {
  // Peças duplas sempre ficam verticais (cruzadas)
  return piece.top === piece.bottom && piece.top > 0 ? 'vertical' : 'horizontal';
};

/**
 * Calcula todas as conexões em sequência correta para dominó
 */
export const calculateAllConnections = (pieces: DominoPieceType[]): PieceConnection[] => {
  if (pieces.length === 0) return [];

  const connections: PieceConnection[] = [];
  
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    let leftConnection: number | null = null;
    let rightConnection: number | null = null;
    let isFlipped = false;
    
    // Verificar se é uma peça dupla
    const isDupla = piece.top === piece.bottom && piece.top > 0;
    
    // Aplicar a regra de orientação
    const orientation = calculatePieceOrientation(piece, i, pieces);

    if (i === 0) {
      // Primeira peça - não precisa conectar com nada
      leftConnection = piece.top;
      rightConnection = piece.bottom;
    } else {
      // Peças subsequentes devem conectar com a anterior
      const previousConnection = connections[i - 1];
      const requiredConnection = previousConnection.rightConnection;
      
      // Verificar qual lado da peça atual conecta com a peça anterior
      if (piece.top === requiredConnection) {
        // Conecta pelo top - mantém orientação normal
        leftConnection = piece.top;
        rightConnection = piece.bottom;
        isFlipped = false;
      } else if (piece.bottom === requiredConnection) {
        // Conecta pelo bottom - inverte a peça logicamente
        leftConnection = piece.bottom;
        rightConnection = piece.top;
        isFlipped = true;
      } else {
        // Não há conexão válida - erro na sequência
        console.warn(`Peça ${i} [${piece.top}|${piece.bottom}] não conecta com valor ${requiredConnection}`);
        // Tenta usar a peça mesmo assim
        leftConnection = piece.top;
        rightConnection = piece.bottom;
      }
    }

    connections.push({
      piece,
      index: i,
      leftConnection,
      rightConnection,
      orientation,
      position: { x: 0, y: 0 }, // Será calculado no layout
      isFlipped,
      isDupla
    });
  }

  return connections;
};

/**
 * Calcula as extremidades atuais do tabuleiro
 */
export const calculateBoardEnds = (pieces: DominoPieceType[]): BoardEnds => {
  if (pieces.length === 0) {
    return {
      leftEnd: null,
      rightEnd: null,
      leftPieceIndex: null,
      rightPieceIndex: null
    };
  }

  const connections = calculateAllConnections(pieces);
  if (connections.length === 0) {
    return {
      leftEnd: null,
      rightEnd: null,
      leftPieceIndex: null,
      rightPieceIndex: null
    };
  }

  const firstConnection = connections[0];
  const lastConnection = connections[connections.length - 1];

  return {
    leftEnd: firstConnection.leftConnection,
    rightEnd: lastConnection.rightConnection,
    leftPieceIndex: 0,
    rightPieceIndex: pieces.length - 1
  };
};

/**
 * Valida se a sequência de peças está corretamente conectada
 */
export const validateBoardSequence = (pieces: DominoPieceType[]): {
  isValid: boolean;
  errors: string[];
  connections: PieceConnection[];
} => {
  const errors: string[] = [];
  const connections = calculateAllConnections(pieces);

  for (let i = 1; i < connections.length; i++) {
    const current = connections[i];
    const previous = connections[i - 1];

    if (previous.rightConnection !== current.leftConnection) {
      errors.push(
        `Peça ${i} não conecta corretamente com a peça ${i - 1}: ` +
        `${previous.rightConnection} ≠ ${current.leftConnection}`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    connections
  };
};

/**
 * Determina onde uma nova peça pode ser jogada
 */
export const findPlayablePositions = (
  newPiece: DominoPieceType,
  currentPieces: DominoPieceType[]
): Array<{ side: 'left' | 'right'; orientation: 'vertical' | 'horizontal' }> => {
  const positions: Array<{ side: 'left' | 'right'; orientation: 'vertical' | 'horizontal' }> = [];
  const boardEnds = calculateBoardEnds(currentPieces);

  const pieceOrientation = calculatePieceOrientation(newPiece, 0, []);

  // Verificar conexão na extremidade esquerda
  if (boardEnds.leftEnd !== null) {
    if (newPiece.top === boardEnds.leftEnd || newPiece.bottom === boardEnds.leftEnd) {
      positions.push({ side: 'left', orientation: pieceOrientation });
    }
  }

  // Verificar conexão na extremidade direita
  if (boardEnds.rightEnd !== null) {
    if (newPiece.top === boardEnds.rightEnd || newPiece.bottom === boardEnds.rightEnd) {
      positions.push({ side: 'right', orientation: pieceOrientation });
    }
  }

  // Se o tabuleiro está vazio, qualquer posição é válida
  if (currentPieces.length === 0) {
    positions.push({ side: 'left', orientation: pieceOrientation });
  }

  return positions;
};
