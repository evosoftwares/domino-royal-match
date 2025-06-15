
import { DominoPieceType } from '@/types/game';

export interface PieceConnection {
  piece: DominoPieceType;
  index: number;
  leftConnection: number | null;
  rightConnection: number | null;
  topConnection: number | null; // Para peças duplas (spinner)
  bottomConnection: number | null; // Para peças duplas (spinner)
  orientation: 'vertical' | 'horizontal';
  position: { x: number; y: number };
  isFlipped: boolean;
  isDupla: boolean;
  isSpinner: boolean; // Marca se a peça dupla permite conexões nos 4 lados
}

export interface BoardEnds {
  leftEnd: number | null;
  rightEnd: number | null;
  topEnds: Array<{ pieceIndex: number; value: number }>; // Extremidades superiores das peças duplas
  bottomEnds: Array<{ pieceIndex: number; value: number }>; // Extremidades inferiores das peças duplas
  leftPieceIndex: number | null;
  rightPieceIndex: number | null;
}

/**
 * Calcula a orientação correta de uma peça baseada nos valores
 * REGRA: Peças duplas ficam sempre transversais (cruzadas) - orientação vertical
 */
export const calculatePieceOrientation = (
  piece: DominoPieceType,
  index: number,
  pieces: DominoPieceType[],
  connectionValue?: number
): 'vertical' | 'horizontal' => {
  // Peças duplas sempre ficam verticais (transversais/cruzadas)
  return piece.top === piece.bottom && piece.top > 0 ? 'vertical' : 'horizontal';
};

/**
 * Verifica se uma peça dupla já tem conexões em todos os lados disponíveis
 */
const isSpinnerFull = (connection: PieceConnection, allConnections: PieceConnection[]): boolean => {
  if (!connection.isSpinner) return false;
  
  let connectionsCount = 0;
  
  // Conta conexões principais (esquerda/direita)
  if (connection.leftConnection !== null) connectionsCount++;
  if (connection.rightConnection !== null) connectionsCount++;
  
  // Conta conexões dos lados da peça dupla (cima/baixo)
  if (connection.topConnection !== null) connectionsCount++;
  if (connection.bottomConnection !== null) connectionsCount++;
  
  // Uma peça dupla pode ter no máximo 4 conexões
  return connectionsCount >= 4;
};

/**
 * Calcula todas as conexões em sequência correta para dominó
 * IMPLEMENTA REGRAS: Corrente única, conexão pelas extremidades, números iguais, peças duplas transversais
 */
export const calculateAllConnections = (pieces: DominoPieceType[]): PieceConnection[] => {
  if (pieces.length === 0) return [];

  const connections: PieceConnection[] = [];
  
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    let leftConnection: number | null = null;
    let rightConnection: number | null = null;
    let topConnection: number | null = null;
    let bottomConnection: number | null = null;
    let isFlipped = false;
    
    // Verificar se é uma peça dupla
    const isDupla = piece.top === piece.bottom && piece.top > 0;
    
    // REGRA 4: Peças duplas ficam transversais (cruzadas)
    const orientation = calculatePieceOrientation(piece, i, pieces);
    
    // Determinar se a peça dupla funcionará como spinner
    const isSpinner = isDupla;

    if (i === 0) {
      // Primeira peça - inicia a corrente
      leftConnection = piece.top;
      rightConnection = piece.bottom;
      
      // Se for peça dupla, as conexões superior e inferior ficam disponíveis
      if (isSpinner) {
        topConnection = piece.top; // Disponível para conexão
        bottomConnection = piece.bottom; // Disponível para conexão
      }
    } else {
      // REGRA 2: Peças subsequentes só podem conectar nas extremidades
      const previousConnection = connections[i - 1];
      const requiredConnection = previousConnection.rightConnection;
      
      // REGRA 3: Números iguais para conectar
      if (piece.top === requiredConnection) {
        leftConnection = piece.top;
        rightConnection = piece.bottom;
        isFlipped = false;
      } else if (piece.bottom === requiredConnection) {
        leftConnection = piece.bottom;
        rightConnection = piece.top;
        isFlipped = true;
      } else {
        // Verificar se pode conectar em uma peça dupla anterior (spinner)
        let connectedToSpinner = false;
        
        for (let j = 0; j < connections.length; j++) {
          const prevConnection = connections[j];
          if (prevConnection.isSpinner && !isSpinnerFull(prevConnection, connections)) {
            // Tentar conectar no lado superior da peça dupla
            if (prevConnection.topConnection === piece.top || prevConnection.topConnection === piece.bottom) {
              leftConnection = piece.top;
              rightConnection = piece.bottom;
              connectedToSpinner = true;
              break;
            }
            // Tentar conectar no lado inferior da peça dupla
            if (prevConnection.bottomConnection === piece.top || prevConnection.bottomConnection === piece.bottom) {
              leftConnection = piece.top;
              rightConnection = piece.bottom;
              connectedToSpinner = true;
              break;
            }
          }
        }
        
        if (!connectedToSpinner) {
          console.warn(`Peça ${i} [${piece.top}|${piece.bottom}] não conecta com valor ${requiredConnection}`);
          leftConnection = piece.top;
          rightConnection = piece.bottom;
        }
      }
      
      // Se for peça dupla (spinner), configurar conexões dos lados
      if (isSpinner) {
        topConnection = piece.top;
        bottomConnection = piece.bottom;
      }
    }

    connections.push({
      piece,
      index: i,
      leftConnection,
      rightConnection,
      topConnection,
      bottomConnection,
      orientation,
      position: { x: 0, y: 0 }, // Será calculado no layout
      isFlipped,
      isDupla,
      isSpinner
    });
  }

  return connections;
};

/**
 * REGRA 1 e 2: Calcula as extremidades atuais da corrente única
 * Inclui extremidades principais e das peças duplas (spinners)
 */
export const calculateBoardEnds = (pieces: DominoPieceType[]): BoardEnds => {
  if (pieces.length === 0) {
    return {
      leftEnd: null,
      rightEnd: null,
      topEnds: [],
      bottomEnds: [],
      leftPieceIndex: null,
      rightPieceIndex: null
    };
  }

  const connections = calculateAllConnections(pieces);
  if (connections.length === 0) {
    return {
      leftEnd: null,
      rightEnd: null,
      topEnds: [],
      bottomEnds: [],
      leftPieceIndex: null,
      rightPieceIndex: null
    };
  }

  const firstConnection = connections[0];
  const lastConnection = connections[connections.length - 1];
  
  // Extremidades principais da corrente
  const leftEnd = firstConnection.leftConnection;
  const rightEnd = lastConnection.rightConnection;
  
  // Extremidades das peças duplas (spinners) disponíveis
  const topEnds: Array<{ pieceIndex: number; value: number }> = [];
  const bottomEnds: Array<{ pieceIndex: number; value: number }> = [];
  
  connections.forEach((connection, index) => {
    if (connection.isSpinner && !isSpinnerFull(connection, connections)) {
      if (connection.topConnection !== null) {
        topEnds.push({ pieceIndex: index, value: connection.topConnection });
      }
      if (connection.bottomConnection !== null) {
        bottomEnds.push({ pieceIndex: index, value: connection.bottomConnection });
      }
    }
  });

  return {
    leftEnd,
    rightEnd,
    topEnds,
    bottomEnds,
    leftPieceIndex: 0,
    rightPieceIndex: pieces.length - 1
  };
};

/**
 * REGRA 1: Valida se a sequência forma uma corrente única correta
 */
export const validateBoardSequence = (pieces: DominoPieceType[]): {
  isValid: boolean;
  errors: string[];
  connections: PieceConnection[];
} => {
  const errors: string[] = [];
  const connections = calculateAllConnections(pieces);

  // Verificar corrente única - cada peça deve conectar corretamente
  for (let i = 1; i < connections.length; i++) {
    const current = connections[i];
    const previous = connections[i - 1];

    if (previous.rightConnection !== current.leftConnection) {
      errors.push(
        `REGRA VIOLADA: Peça ${i} não forma corrente única com a peça ${i - 1}: ` +
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
 * REGRA 2 e 5: Determina onde uma nova peça pode ser jogada
 * Inclui extremidades principais e das peças duplas (spinners)
 */
export const findPlayablePositions = (
  newPiece: DominoPieceType,
  currentPieces: DominoPieceType[]
): Array<{ 
  side: 'left' | 'right' | 'spinner-top' | 'spinner-bottom'; 
  orientation: 'vertical' | 'horizontal';
  spinnerIndex?: number;
}> => {
  const positions: Array<{ 
    side: 'left' | 'right' | 'spinner-top' | 'spinner-bottom'; 
    orientation: 'vertical' | 'horizontal';
    spinnerIndex?: number;
  }> = [];
  
  const boardEnds = calculateBoardEnds(currentPieces);
  const pieceOrientation = calculatePieceOrientation(newPiece, 0, []);

  // REGRA 2: Verificar conexão nas extremidades principais
  if (boardEnds.leftEnd !== null) {
    if (newPiece.top === boardEnds.leftEnd || newPiece.bottom === boardEnds.leftEnd) {
      positions.push({ side: 'left', orientation: pieceOrientation });
    }
  }

  if (boardEnds.rightEnd !== null) {
    if (newPiece.top === boardEnds.rightEnd || newPiece.bottom === boardEnds.rightEnd) {
      positions.push({ side: 'right', orientation: pieceOrientation });
    }
  }

  // REGRA 5: Verificar conexões nas peças duplas (spinners)
  boardEnds.topEnds.forEach(end => {
    if (newPiece.top === end.value || newPiece.bottom === end.value) {
      positions.push({ 
        side: 'spinner-top', 
        orientation: pieceOrientation,
        spinnerIndex: end.pieceIndex
      });
    }
  });

  boardEnds.bottomEnds.forEach(end => {
    if (newPiece.top === end.value || newPiece.bottom === end.value) {
      positions.push({ 
        side: 'spinner-bottom', 
        orientation: pieceOrientation,
        spinnerIndex: end.pieceIndex
      });
    }
  });

  // Se o tabuleiro está vazio, qualquer posição é válida
  if (currentPieces.length === 0) {
    positions.push({ side: 'left', orientation: pieceOrientation });
  }

  return positions;
};

/**
 * REGRA 6: Verifica se o jogo está "trancado" (fechado)
 */
export const isGameBlocked = (
  playerHands: DominoPieceType[][],
  currentPieces: DominoPieceType[]
): { isBlocked: boolean; reason?: string } => {
  const boardEnds = calculateBoardEnds(currentPieces);
  
  // Coletar todos os valores das extremidades disponíveis
  const availableEnds: number[] = [];
  
  if (boardEnds.leftEnd !== null) availableEnds.push(boardEnds.leftEnd);
  if (boardEnds.rightEnd !== null) availableEnds.push(boardEnds.rightEnd);
  
  boardEnds.topEnds.forEach(end => availableEnds.push(end.value));
  boardEnds.bottomEnds.forEach(end => availableEnds.push(end.value));
  
  // Verificar se algum jogador tem peça que conecta
  for (const hand of playerHands) {
    for (const piece of hand) {
      for (const endValue of availableEnds) {
        if (piece.top === endValue || piece.bottom === endValue) {
          return { isBlocked: false };
        }
      }
    }
  }
  
  return { 
    isBlocked: true, 
    reason: `Jogo trancado - extremidades [${availableEnds.join(', ')}] não correspondem a nenhuma peça dos jogadores`
  };
};
