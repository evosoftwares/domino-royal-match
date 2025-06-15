
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Clock, Crown, Zap } from 'lucide-react';
import { useSimpleMatchmaking } from '@/hooks/useSimpleMatchmaking';

const MatchmakingQueue: React.FC = () => {
  const {
    isInQueue,
    queueCount,
    isLoading,
    queuePlayers,
    joinQueue,
    leaveQueue,
    refreshQueue
  } = useSimpleMatchmaking();

  const isNearGameStart = queueCount >= 3;
  const isGameReady = queueCount >= 4;

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Users className="h-6 w-6" />
            Fila de Matchmaking
          </CardTitle>
          <CardDescription>
            Encontre jogadores para uma partida de dominó
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Badge 
                variant={isGameReady ? "default" : isNearGameStart ? "secondary" : "outline"} 
                className={`text-lg px-4 py-2 ${
                  isGameReady ? "bg-green-600 animate-pulse" : 
                  isNearGameStart ? "bg-yellow-600" : ""
                }`}
              >
                <Users className="h-4 w-4 mr-2" />
                {queueCount}/4 Jogadores
              </Badge>
              
              {isGameReady && (
                <Badge variant="default" className="text-green-600 border-green-600 animate-pulse">
                  <Zap className="h-4 w-4 mr-1" />
                  Criando Jogo...
                </Badge>
              )}
              
              {isNearGameStart && !isGameReady && (
                <Badge variant="secondary" className="text-yellow-600 border-yellow-600">
                  <Crown className="h-4 w-4 mr-1" />
                  Quase pronto!
                </Badge>
              )}
            </div>

            {/* Status message */}
            {isGameReady && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-green-700 font-medium">
                  🎮 Jogo encontrado! Preparando tabuleiro...
                </p>
              </div>
            )}
            
            {!isInQueue ? (
              <Button 
                onClick={joinQueue} 
                disabled={isLoading || isGameReady}
                size="lg"
                className="w-full max-w-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando na fila...
                  </>
                ) : (
                  <>
                    <Users className="mr-2 h-4 w-4" />
                    Entrar na Fila
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Clock className="h-4 w-4 animate-pulse" />
                  <span className="font-medium">Você está na fila</span>
                  {isNearGameStart && (
                    <span className="text-yellow-600">- Aguarde!</span>
                  )}
                </div>
                <Button 
                  onClick={leaveQueue} 
                  disabled={isLoading || isGameReady}
                  variant="outline"
                  size="lg"
                  className="w-full max-w-sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saindo da fila...
                    </>
                  ) : (
                    'Sair da Fila'
                  )}
                </Button>
              </div>
            )}
          </div>

          {queuePlayers.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-center">
                Jogadores na Fila
                {isNearGameStart && (
                  <span className="text-sm text-yellow-600 ml-2">
                    (Jogo iniciando em breve!)
                  </span>
                )}
              </h3>
              <div className="grid gap-3">
                {queuePlayers.map((player, index) => (
                  <div 
                    key={player.id} 
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      isGameReady ? 'bg-green-50 border-green-200' : 
                      isNearGameStart ? 'bg-yellow-50 border-yellow-200' : 
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">
                        #{index + 1}
                      </span>
                      {index === 0 && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={player.avatarUrl} />
                      <AvatarFallback>
                        {player.displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="font-medium text-sm">{player.displayName}</div>
                    </div>
                    
                    <Badge variant={isGameReady ? "default" : "outline"}>
                      {isGameReady ? "Pronto!" : "Esperando"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center">
            <Button 
              onClick={refreshQueue} 
              variant="ghost" 
              size="sm"
              disabled={isLoading || isGameReady}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Atualizar Fila'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MatchmakingQueue;
