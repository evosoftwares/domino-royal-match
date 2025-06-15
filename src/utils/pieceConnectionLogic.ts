
import { DominoPieceType } from '@/types/game';

export interface PieceConnection {
  piece: DominoPieceType;
  index: number;
  leftConnection: number | null;
  rightConnection: number | null;
  orientation: 'vertical' | 'horizontal';
  position: { x: number; y: number };
}

export interface BoardEnds {
  leftEnd: number | null;
  rightEnd: number | null;
  leftPieceIndex: number | null;
  rightPieceIndex: number | null;
}

/**
 * Calcula a orientação correta de uma peça baseada nos valores
 * Regra: Peças com valores iguais ficam verticais, diferentes ficam horizontais
 */
export const calculatePieceOrientation = (
  piece: DominoPieceType,
  index: number,
  pieces: DominoPieceType[],
  connectionValue?: number
): 'vertical' | 'horizontal' => {
  // Regra principal: valores iguais = vertical, valores diferentes = horizontal
  return piece.top === piece.bottom ? 'vertical' : 'horizontal';
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

  if (pieces.length === 1) {
    const piece = pieces[0];
    const orientation = calculatePieceOrientation(piece, 0, pieces);
    
    if (orientation === 'vertical') {
      return {
        leftEnd: piece.top,
        rightEnd: piece.bottom,
        leftPieceIndex: 0,
        rightPieceIndex: 0
      };
    } else {
      return {
        leftEnd: piece.top,
        rightEnd: piece.bottom,
        leftPieceIndex: 0,
        rightPieceIndex: 0
      };
    }
  }

  // Para múltiplas peças, calcular as extremidades baseado na sequência
  const connections = calculateAllConnections(pieces);
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
 * Calcula todas as conexões em sequência
 */
export const calculateAllConnections = (pieces: DominoPieceType[]): PieceConnection[] => {
  if (pieces.length === 0) return [];

  const connections: PieceConnection[] = [];
  
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    let leftConnection: number | null = null;
    let rightConnection: number | null = null;
    
    // Aplicar a regra de orientação: iguais = vertical, diferentes = horizontal
    const orientation = calculatePieceOrientation(piece, i, pieces);

    if (i === 0) {
      // Primeira peça
      if (orientation === 'vertical') {
        leftConnection = piece.top;
        rightConnection = piece.bottom;
      } else {
        leftConnection = piece.top;
        rightConnection = piece.bottom;
      }
    } else {
      // Peças subsequentes - conectar com a anterior
      const previousConnection = connections[i - 1];
      const connectingValue = previousConnection.rightConnection;
      
      if (piece.top === connectingValue) {
        leftConnection = connectingValue;
        rightConnection = piece.bottom;
      } else if (piece.bottom === connectingValue) {
        leftConnection = connectingValue;
        rightConnection = piece.top;
      } else {
        // Fallback se não houver conexão clara
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
      position: { x: i * 70, y: 0 }
    });
  }

  return connections;
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

  // Calcular orientação baseada na regra: iguais = vertical, diferentes = horizontal
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
