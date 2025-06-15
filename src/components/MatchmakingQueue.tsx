
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Clock, Crown } from 'lucide-react';
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
              <Badge variant={queueCount >= 4 ? "default" : "secondary"} className="text-lg px-4 py-2">
                <Users className="h-4 w-4 mr-2" />
                {queueCount}/4 Jogadores
              </Badge>
              {queueCount >= 4 && (
                <Badge variant="default" className="text-green-600 border-green-600">
                  <Crown className="h-4 w-4 mr-1" />
                  Criando Jogo...
                </Badge>
              )}
            </div>
            
            {!isInQueue ? (
              <Button 
                onClick={joinQueue} 
                disabled={isLoading}
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
                </div>
                <Button 
                  onClick={leaveQueue} 
                  disabled={isLoading}
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
              <h3 className="text-lg font-semibold text-center">Jogadores na Fila</h3>
              <div className="grid gap-3">
                {queuePlayers.map((player, index) => (
                  <div 
                    key={player.id} 
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">
                        #{index + 1}
                      </span>
                      {index === 0 && (
                        <Crown className="h-4 w-4 text-yellow-500" title="Líder da fila" />
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
                    
                    <Badge variant="outline" size="sm">
                      Esperando
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
              disabled={isLoading}
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
