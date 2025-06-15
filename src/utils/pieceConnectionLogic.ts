
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
 * Calcula a orientação correta de uma peça baseada em sua conexão
 */
export const calculatePieceOrientation = (
  piece: DominoPieceType,
  index: number,
  pieces: DominoPieceType[],
  connectionValue?: number
): 'vertical' | 'horizontal' => {
  // Primeira peça: usar regra simples (iguais = vertical, diferentes = horizontal)
  if (index === 0) {
    return piece.top === piece.bottom ? 'vertical' : 'horizontal';
  }

  // Para peças subsequentes, determinar orientação baseada na conexão
  if (connectionValue !== undefined) {
    // Se o valor de conexão está no 'top', a peça deve ser orientada para conectar corretamente
    if (piece.top === connectionValue) {
      return 'horizontal'; // top conecta com a peça anterior
    } else if (piece.bottom === connectionValue) {
      return 'vertical'; // bottom conecta com a peça anterior
    }
  }

  // Fallback para regra simples
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
    let orientation: 'vertical' | 'horizontal';

    if (i === 0) {
      // Primeira peça
      orientation = calculatePieceOrientation(piece, i, pieces);
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
      
      orientation = calculatePieceOrientation(piece, i, pieces, connectingValue);
      
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
      position: { x: i * 70, y: 0 } // Posicionamento linear básico
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

  // Verificar conexão na extremidade esquerda
  if (boardEnds.leftEnd !== null) {
    if (newPiece.top === boardEnds.leftEnd || newPiece.bottom === boardEnds.leftEnd) {
      const orientation = newPiece.top === boardEnds.leftEnd ? 'horizontal' : 'vertical';
      positions.push({ side: 'left', orientation });
    }
  }

  // Verificar conexão na extremidade direita
  if (boardEnds.rightEnd !== null) {
    if (newPiece.top === boardEnds.rightEnd || newPiece.bottom === boardEnds.rightEnd) {
      const orientation = newPiece.top === boardEnds.rightEnd ? 'horizontal' : 'vertical';
      positions.push({ side: 'right', orientation });
    }
  }

  // Se o tabuleiro está vazio, qualquer posição é válida
  if (currentPieces.length === 0) {
    positions.push({ side: 'left', orientation: newPiece.top === newPiece.bottom ? 'vertical' : 'horizontal' });
  }

  return positions;
};
