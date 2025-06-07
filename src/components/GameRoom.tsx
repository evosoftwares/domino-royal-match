
import React, { useState, useEffect } from 'react';
import GameBoard from './GameBoard';
import PlayerArea from './PlayerArea';
import { generateDominoPieces, distributePieces, DominoPieceType } from '@/utils/dominoUtils';
import { toast } from 'sonner';

interface Player {
  id: string;
  name: string;
  pieces: DominoPieceType[];
  isCurrentPlayer: boolean;
}

const GameRoom: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [placedPieces, setPlacedPieces] = useState<DominoPieceType[]>([]);
  const [currentDraggedPiece, setCurrentDraggedPiece] = useState<DominoPieceType | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [gameStarted, setGameStarted] = useState(false);

  // Simular 4 jogadores para demonstração
  useEffect(() => {
    const allPieces = generateDominoPieces();
    const distributedPieces = distributePieces(allPieces);
    
    const mockPlayers: Player[] = [
      {
        id: '1',
        name: 'Você',
        pieces: distributedPieces.player1,
        isCurrentPlayer: true
      },
      {
        id: '2',
        name: 'Jogador 2',
        pieces: distributedPieces.player2,
        isCurrentPlayer: false
      },
      {
        id: '3',
        name: 'Jogador 3',
        pieces: distributedPieces.player3,
        isCurrentPlayer: false
      },
      {
        id: '4',
        name: 'Jogador 4',
        pieces: distributedPieces.player4,
        isCurrentPlayer: false
      }
    ];
    
    setPlayers(mockPlayers);
    setGameStarted(true);
    toast.success("Jogo iniciado! Arraste uma peça para o centro da mesa.");
  }, []);

  // Timer do jogador atual
  useEffect(() => {
    if (!gameStarted) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Jogada automática quando o tempo acaba
          handleAutoPlay();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, players]);

  const handleAutoPlay = () => {
    const currentPlayer = players.find(p => p.isCurrentPlayer);
    if (currentPlayer && currentPlayer.pieces.length > 0) {
      // Escolhe uma peça aleatória para jogada automática
      const randomPiece = currentPlayer.pieces[Math.floor(Math.random() * currentPlayer.pieces.length)];
      handlePiecePlayed(randomPiece);
      toast.info("Tempo esgotado! Peça jogada automaticamente.");
    }
  };

  const handlePieceDrag = (piece: DominoPieceType) => {
    setCurrentDraggedPiece(piece);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (currentDraggedPiece) {
      handlePiecePlayed(currentDraggedPiece);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handlePiecePlayed = (piece: DominoPieceType) => {
    const currentPlayer = players.find(p => p.isCurrentPlayer);
    if (!currentPlayer) return;

    // Adiciona a peça ao tabuleiro
    setPlacedPieces(prev => [...prev, piece]);

    // Remove a peça do jogador e passa a vez
    setPlayers(prev => {
      const newPlayers = prev.map(player => {
        if (player.id === currentPlayer.id) {
          const newPieces = player.pieces.filter(p => p.id !== piece.id);
          
          // Verifica vitória
          if (newPieces.length === 0) {
            toast.success(`${player.name} venceu! 🎉`);
          }
          
          return {
            ...player,
            pieces: newPieces,
            isCurrentPlayer: false
          };
        }
        return player;
      });

      // Passa a vez para o próximo jogador
      const currentIndex = prev.findIndex(p => p.isCurrentPlayer);
      const nextIndex = (currentIndex + 1) % prev.length;
      newPlayers[nextIndex].isCurrentPlayer = true;

      return newPlayers;
    });

    setCurrentDraggedPiece(null);
    setTimeLeft(10);

    toast.info(`Peça ${piece.top}-${piece.bottom} jogada!`);
  };

  const currentPlayer = players.find(p => p.isCurrentPlayer);
  const otherPlayers = players.filter(p => !p.isCurrentPlayer);

  if (!gameStarted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-purple-200 text-lg">Aguardando jogadores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Informações da partida */}
      <div className="bg-gradient-to-r from-purple-900/50 to-black/50 rounded-2xl p-6 border border-purple-600/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Partida em Andamento</h2>
            <p className="text-purple-200">Aposta: R$ 1,00 • Prêmio: R$ 4,00</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-yellow-400">{placedPieces.length}</div>
            <div className="text-purple-200 text-sm">peças jogadas</div>
          </div>
        </div>
      </div>

      {/* Área dos outros jogadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {otherPlayers.map((player) => (
          <div key={player.id} className="bg-gradient-to-r from-purple-900/30 to-black/30 rounded-xl p-4 border border-purple-600/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 bg-gray-500 rounded-full" />
              <span className="text-purple-200 font-medium">{player.name}</span>
            </div>
            <div className="text-2xl font-bold text-white">{player.pieces.length}</div>
            <div className="text-purple-300 text-sm">peças restantes</div>
          </div>
        ))}
      </div>

      {/* Tabuleiro central */}
      <GameBoard
        placedPieces={placedPieces}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      />

      {/* Área do jogador atual */}
      {currentPlayer && (
        <PlayerArea
          playerPieces={currentPlayer.pieces}
          onPieceDrag={handlePieceDrag}
          isCurrentPlayer={currentPlayer.isCurrentPlayer}
          playerName={currentPlayer.name}
          timeLeft={timeLeft}
        />
      )}
    </div>
  );
};

export default GameRoom;
