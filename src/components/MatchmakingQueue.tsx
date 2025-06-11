
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { toast } from 'sonner';

// Importação dos componentes de UI e ícones
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Users, Clock, UserPlus, UserMinus, AlertCircle, RefreshCw } from 'lucide-react';

// --- Sub-componentes para a UI ---

const PlayerSlot: React.FC<{ 
  player: { id: string; displayName: string; avatarUrl: string; position: number }; 
  isCurrentUser: boolean;
  position: number;
}> = ({ player, isCurrentUser, position }) => (
  <div className="animate-fade-in flex flex-col items-center p-4 bg-slate-800/90 rounded-xl border border-slate-700/50 transition-all duration-300 hover:border-blue-500/50 hover:bg-slate-700/90">
    <Avatar className="w-16 h-16 mb-3 border-2 border-blue-400">
      <AvatarImage src={player.avatarUrl} alt={`Avatar de ${player.displayName}`} />
      <AvatarFallback className="bg-blue-600 text-white font-semibold">
        {player.displayName.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
    <span className="text-slate-100 font-medium text-sm text-center truncate w-full">
      {player.displayName}
    </span>
    <div className="flex items-center mt-2 text-emerald-400 text-xs font-medium">
      <div className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
      {isCurrentUser ? 'Você' : `Posição ${position}`}
    </div>
  </div>
);

const EmptySlot: React.FC<{ position: number }> = ({ position }) => (
  <div className="flex flex-col items-center p-4 bg-slate-900/50 rounded-xl border border-slate-800/50 transition-all duration-300">
    <div className="w-16 h-16 mb-3 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center">
      <UserPlus className="w-8 h-8 text-slate-500" />
    </div>
    <span className="text-slate-400 text-sm text-center">Aguardando...</span>
    <div className="flex items-center mt-2 text-slate-500 text-xs">
      <Clock className="w-3 h-3 mr-1" />
      Posição {position}
    </div>
  </div>
);

const LoadingSkeleton: React.FC = () => (
  <div className="flex flex-col items-center p-4 bg-slate-800/50 rounded-xl border border-slate-700/30">
    <Skeleton className="w-16 h-16 rounded-full mb-3 bg-slate-700" />
    <Skeleton className="h-4 w-20 mb-2 bg-slate-700" />
    <Skeleton className="h-3 w-16 bg-slate-700" />
  </div>
);

// --- Componente Principal ---
const MatchmakingQueue: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    queuePlayers, 
    queueCount, 
    isInQueue, 
    isLoading, 
    joinQueue, 
    leaveQueue,
    refreshQueue 
  } = useMatchmaking();

  const handleJoinQueue = async () => {
    if (!user) {
      toast.error('Você precisa estar logado para entrar na fila');
      return;
    }
    await joinQueue();
  };

  const handleLeaveQueue = async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }
    await leaveQueue();
  };

  const handleRefresh = async () => {
    await refreshQueue();
    toast.success('Fila atualizada!');
  };

  // Se está carregando inicialmente
  if (isLoading && queuePlayers.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto bg-slate-900/95">
        <CardHeader className="text-center p-4 border-b border-slate-700/50">
          <CardTitle className="text-slate-100">Carregando Sala...</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
          {Array.from({ length: 4 }).map((_, index) => <LoadingSkeleton key={index} />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto bg-slate-900/95 border-slate-700/50 shadow-2xl">
      <CardHeader className="text-center p-4 border-b border-slate-700/50">
        <CardTitle className="text-slate-100 flex items-center justify-center gap-2 text-xl font-bold">
          <Users className="w-6 h-6 text-blue-400" />
          Procurando Partida
          <Button
            onClick={handleRefresh}
            variant="ghost"
            size="sm"
            className="ml-2 text-slate-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
        <p className="text-slate-300 text-sm font-medium">{queueCount}/4 jogadores na fila</p>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => {
            const player = queuePlayers[index];
            return player ? (
              <PlayerSlot 
                key={player.id} 
                player={player} 
                isCurrentUser={player.id === user?.id}
                position={player.position}
              />
            ) : (
              <EmptySlot key={index} position={index + 1} />
            );
          })}
        </div>
        
        <div className="bg-slate-800/70 rounded-lg p-4 border border-slate-700/30">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <span className="text-slate-400 font-medium">Taxa de entrada:</span>
              <div className="text-slate-100 font-bold text-lg">R$ 1,10</div>
            </div>
            <div className="text-center">
              <span className="text-slate-400 font-medium">Prêmio total:</span>
              <div className="text-emerald-400 font-bold text-lg">R$ 4,00</div>
            </div>
          </div>
        </div>

        <Button
          onClick={isInQueue ? handleLeaveQueue : handleJoinQueue}
          disabled={!user || isLoading || (queueCount >= 4 && !isInQueue)}
          className={`w-full transition-all duration-300 font-semibold text-base py-3 ${
            isInQueue 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : isInQueue ? (
            <UserMinus className="w-5 h-5 mr-2" />
          ) : (
            <UserPlus className="w-5 h-5 mr-2" />
          )}
          {isLoading ? (isInQueue ? 'Saindo...' : 'Entrando...') : (isInQueue ? 'Sair da Fila' : 'Entrar na Fila')}
        </Button>

        {queueCount > 0 && (
          <div className="text-center text-xs text-slate-400">
            Atualização automática a cada 3 segundos
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MatchmakingQueue;
