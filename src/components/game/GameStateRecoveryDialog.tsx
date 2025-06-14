
import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface GameStateRecoveryDialogProps {
  isVisible: boolean;
  corruption: {
    hasCorruptedState: boolean;
    corruptionType: 'empty_board' | 'invalid_players' | 'missing_data' | 'unknown';
    confidence: number;
  };
  isRecovering: boolean;
  recoveryAttempts: number;
  hasBackup: boolean;
  onRecovery: (useBackup: boolean) => void;
  onManualRefresh: () => void;
  onDismiss: () => void;
}

const GameStateRecoveryDialog: React.FC<GameStateRecoveryDialogProps> = ({
  isVisible,
  corruption,
  isRecovering,
  recoveryAttempts,
  hasBackup,
  onRecovery,
  onManualRefresh,
  onDismiss
}) => {
  if (!isVisible) return null;

  const getCorruptionMessage = () => {
    switch (corruption.corruptionType) {
      case 'empty_board':
        return 'O tabuleiro está vazio mas o jogo deveria estar ativo';
      case 'invalid_players':
        return 'Dados dos jogadores estão corrompidos ou ausentes';
      case 'missing_data':
        return 'Dados críticos do jogo estão ausentes';
      default:
        return 'Estado do jogo está inconsistente';
    }
  };

  const getRecoveryRecommendation = () => {
    if (corruption.corruptionType === 'empty_board') {
      return 'Tentaremos reconstruir o tabuleiro automaticamente';
    }
    if (hasBackup) {
      return 'Podemos restaurar o último estado válido conhecido';
    }
    return 'Faremos uma sincronização completa com o servidor';
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full bg-slate-900/95 border-red-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            Estado do Jogo Corrompido
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-slate-300">
            <p className="mb-2">{getCorruptionMessage()}</p>
            <p className="text-sm text-slate-400">
              Confiança: {(corruption.confidence * 100).toFixed(0)}%
            </p>
          </div>

          <div className="bg-slate-800/50 p-3 rounded-lg">
            <p className="text-sm text-slate-300">{getRecoveryRecommendation()}</p>
          </div>

          {recoveryAttempts > 0 && (
            <div className="text-orange-300 text-sm">
              Tentativas de recuperação: {recoveryAttempts}/3
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={() => onRecovery(false)}
              disabled={isRecovering}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isRecovering ? (
                <>
                  <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                  Recuperando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Recuperar Automaticamente
                </>
              )}
            </Button>

            {hasBackup && (
              <Button
                onClick={() => onRecovery(true)}
                disabled={isRecovering}
                variant="outline"
                className="w-full"
              >
                Usar Último Estado Válido
              </Button>
            )}

            <Button
              onClick={onManualRefresh}
              disabled={isRecovering}
              variant="outline"
              className="w-full"
            >
              <Wifi className="w-4 h-4 mr-2" />
              Atualizar Manualmente
            </Button>

            <Button
              onClick={onDismiss}
              disabled={isRecovering}
              variant="ghost"
              className="w-full text-slate-400"
            >
              Continuar Assim Mesmo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GameStateRecoveryDialog;
