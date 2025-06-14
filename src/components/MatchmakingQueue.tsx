
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
import { Loader2, Users, Clock, UserPlus, UserMinus, AlertCircle, RefreshCw, CheckCircle, Timer, Zap, Shield } from 'lucide-react';

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
    refreshQueue,
    isGameCreating,
    retryCount,
    maxRetries
  } = useMatchmaking();

  const handleJoinQueue = async () => {
    if (!user) {
      toast.error('Você precisa estar logado para entrar na fila');
      return;
    }
    
    console.log('🎯 Usuário tentando entrar na fila...');
    await joinQueue();
  };

  const handleLeaveQueue = async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }
    
    console.log('🚪 Usuário saindo da fila...');
    await leaveQueue();
  };

  const handleRefresh = async () => {
    console.log('🔄 Atualizando fila manualmente...');
    await refreshQueue();
    toast.success('Fila atualizada!');
  };

  // Indicadores visuais melhorados com sistema seguro
  const shouldShowGameStarting = queueCount >= 4;
  const showRetryIndicator = retryCount > 0 && retryCount < maxRetries;
  const showFailureIndicator = retryCount >= maxRetries;
  const isSystemSecure = queueCount >= 4 && retryCount < 10;

  // Se está carregando inicialmente
  if (isLoading && queuePlayers.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto bg-slate-900/95">
        <CardHeader className="text-center p-4 border-b border-slate-700/50">
          <CardTitle className="text-slate-100">Carregando Sistema Seguro...</CardTitle>
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
          {shouldShowGameStarting ? 'Sistema Seguro Ativo' : 'Procurando Partida'}
          <Button
            onClick={handleRefresh}
            variant="ghost"
            size="sm"
            className="ml-2 text-slate-400 hover:text-white"
            disabled={isGameCreating}
          >
            <RefreshCw className={`w-4 h-4 ${isGameCreating ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
        <p className="text-slate-300 text-sm font-medium">
          {queueCount}/4 jogadores na fila
          {isSystemSecure && (
            <span className="ml-2 text-emerald-400 animate-pulse flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Sistema seguro v3.0 ativo
            </span>
          )}
          {showRetryIndicator && (
            <span className="ml-2 text-yellow-400 flex items-center gap-1">
              <Timer className="w-3 h-3" />
              Verificação segura {retryCount}/{maxRetries}
            </span>
          )}
          {showFailureIndicator && (
            <span className="ml-2 text-red-400">• Sistema bloqueado - saia e entre novamente</span>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        {/* Indicadores de status com sistema seguro */}
        {shouldShowGameStarting && !showFailureIndicator && (
          <div className="bg-emerald-900/30 border border-emerald-500/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-medium">
              <Shield className="w-4 h-4 animate-pulse" />
              Sistema Seguro v3.0: Criando jogo com proteção total...
              {showRetryIndicator && (
                <span className="text-xs ml-2">
                  (Verificação {retryCount}/{maxRetries})
                </span>
              )}
            </div>
            <div className="text-emerald-300 text-xs mt-2 flex items-center justify-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Lock transacional • Validação rigorosa • Anti-duplicação • Debounce inteligente
            </div>
          </div>
        )}
        
        {showFailureIndicator && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-red-400 font-medium">
              <AlertCircle className="w-4 h-4" />
              Sistema seguro bloqueado após {maxRetries} tentativas
            </div>
            <div className="text-red-300 text-xs mt-2">
              O sistema se protegeu automaticamente. Saia da fila e entre novamente.
            </div>
          </div>
        )}

        {isGameCreating && !showFailureIndicator && retryCount < 8 && (
          <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-blue-400 font-medium">
              <Shield className="w-4 h-4 animate-pulse" />
              Sistema Seguro v3.0 em operação
            </div>
            <div className="text-blue-300 text-xs mt-2 flex items-center justify-center gap-1">
              <Zap className="w-3 h-3" />
              Proteção máxima: Lock • Validação • Prevenção • Monitoramento
            </div>
          </div>
        )}
        
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
          disabled={!user || isLoading || (queueCount >= 4 && !isInQueue && !showFailureIndicator)}
          className={`w-full transition-all duration-300 font-semibold text-base py-3 ${
            isInQueue 
              ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg' 
              : shouldShowGameStarting && !isInQueue && !showFailureIndicator
              ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
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
          {isLoading ? (isInQueue ? 'Saindo...' : 'Entrando...') : 
           isInQueue ? 'Sair da Fila' : 
           shouldShowGameStarting && !isInQueue && !showFailureIndicator ? 'Sistema Seguro Ativo...' : 'Entrar na Fila'}
        </Button>

        {queueCount > 0 && (
          <div className="text-center text-xs text-slate-400">
            {shouldShowGameStarting 
              ? '🛡️ Sistema Seguro v3.0: Proteção máxima com lock transacional + validação rigorosa + anti-duplicação'
              : '🔄 Realtime ativo + debounce inteligente + validação contínua'
            }
            {showRetryIndicator && (
              <div className="mt-1 text-yellow-400 flex items-center justify-center gap-1">
                <Shield className="w-3 h-3" />
                Verificação segura em andamento... ({retryCount}/{maxRetries})
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MatchmakingQueue;
