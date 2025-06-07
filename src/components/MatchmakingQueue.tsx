
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMatchmaking } from '@/hooks/useMatchmaking';
import { Loader2, Users, DollarSign, Timer } from 'lucide-react';

const MatchmakingQueue: React.FC = () => {
  const { isInQueue, queueCount, isLoading, joinQueue, leaveQueue, gameId } = useMatchmaking();

  // Redirecionar quando jogo for encontrado
  React.useEffect(() => {
    if (gameId) {
      // Aqui você pode redirecionar para a tela do jogo
      console.log('Redirecionando para jogo:', gameId);
      // window.location.href = `/game/${gameId}`;
    }
  }, [gameId]);

  if (isInQueue) {
    return (
      <Card className="max-w-md mx-auto bg-gradient-to-br from-purple-900/50 to-black/50 border-purple-600/30">
        <CardHeader className="text-center">
          <CardTitle className="text-white flex items-center justify-center gap-2">
            <Timer className="w-6 h-6 animate-pulse text-yellow-400" />
            Aguardando Jogadores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="relative">
              <div className="w-24 h-24 mx-auto border-4 border-purple-600 rounded-full animate-spin border-t-yellow-400"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">{queueCount}</span>
              </div>
            </div>
            <p className="text-purple-200 mt-4">
              {queueCount < 4 
                ? `${4 - queueCount} jogador(es) necessário(s)` 
                : 'Formando partida...'
              }
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-purple-800/30 rounded-lg border border-purple-600/20">
              <Users className="w-6 h-6 mx-auto text-purple-300 mb-2" />
              <div className="text-white font-semibold">{queueCount}/4</div>
              <div className="text-purple-300 text-sm">Jogadores</div>
            </div>
            <div className="text-center p-3 bg-green-800/30 rounded-lg border border-green-600/20">
              <DollarSign className="w-6 h-6 mx-auto text-green-300 mb-2" />
              <div className="text-white font-semibold">R$ 4,00</div>
              <div className="text-green-300 text-sm">Prêmio</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-purple-300">Taxa de entrada:</span>
              <span className="text-white">R$ 1,10</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-purple-300">Tempo médio:</span>
              <span className="text-white">1-3 minutos</span>
            </div>
          </div>

          <Button 
            onClick={leaveQueue}
            disabled={isLoading}
            variant="destructive"
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saindo...
              </>
            ) : (
              'Sair da Fila'
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto bg-gradient-to-br from-purple-900/50 to-black/50 border-purple-600/30">
      <CardHeader className="text-center">
        <CardTitle className="text-white">Dominó Multiplayer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🎲</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Pronto para jogar?
          </h3>
          <p className="text-purple-200">
            Entre na fila e aguarde outros 3 jogadores
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-green-800/30 rounded-lg border border-green-600/20">
            <DollarSign className="w-6 h-6 mx-auto text-green-300 mb-2" />
            <div className="text-white font-semibold">R$ 4,00</div>
            <div className="text-green-300 text-sm">Prêmio Total</div>
          </div>
          <div className="text-center p-3 bg-yellow-800/30 rounded-lg border border-yellow-600/20">
            <Users className="w-6 h-6 mx-auto text-yellow-300 mb-2" />
            <div className="text-white font-semibold">4</div>
            <div className="text-yellow-300 text-sm">Jogadores</div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-purple-300">Taxa de entrada:</span>
            <span className="text-white">R$ 1,10</span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-300">Saldo mínimo:</span>
            <span className="text-white">R$ 2,20</span>
          </div>
          <div className="flex justify-between">
            <span className="text-purple-300">Na fila agora:</span>
            <span className="text-white">{queueCount} jogador(es)</span>
          </div>
        </div>

        <Button 
          onClick={joinQueue}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Entrando...
            </>
          ) : (
            'Entrar em Partida'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default MatchmakingQueue;
