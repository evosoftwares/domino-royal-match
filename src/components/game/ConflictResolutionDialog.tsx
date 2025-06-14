
import React, { useState } from 'react';
import { AlertTriangle, Shield, Zap, Users, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConflictType } from '@/hooks/useConflictDetection';

interface ConflictResolutionDialogProps {
  isVisible: boolean;
  conflicts: ConflictType[];
  onResolve: (conflictId: string, resolution: 'use_local' | 'use_server' | 'merge', mergedValue?: any) => void;
  onResolveAll: (resolution: 'use_local' | 'use_server') => void;
  onDismiss: () => void;
}

const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  isVisible,
  conflicts,
  onResolve,
  onResolveAll,
  onDismiss
}) => {
  const [selectedConflict, setSelectedConflict] = useState<ConflictType | null>(null);

  if (!isVisible || conflicts.length === 0) return null;

  const getSeverityColor = (severity: ConflictType['severity']) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getSeverityIcon = (severity: ConflictType['severity']) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4" />;
      case 'high': return <Shield className="w-4 h-4" />;
      case 'medium': return <Zap className="w-4 h-4" />;
      case 'low': return <Settings className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const getTypeIcon = (type: ConflictType['type']) => {
    switch (type) {
      case 'player_turn': return <Users className="w-4 h-4" />;
      case 'board_state': return <Shield className="w-4 h-4" />;
      case 'player_hand': return <Users className="w-4 h-4" />;
      case 'game_status': return <AlertTriangle className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  const criticalCount = conflicts.filter(c => c.severity === 'critical').length;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="max-w-4xl w-full bg-slate-900/95 border-red-500/20 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            Conflitos de Estado Detectados
            <Badge variant="destructive" className="ml-2">
              {conflicts.length} conflito{conflicts.length > 1 ? 's' : ''}
            </Badge>
          </CardTitle>
          <p className="text-slate-300">
            {criticalCount > 0 
              ? `${criticalCount} conflito${criticalCount > 1 ? 's' : ''} crítico${criticalCount > 1 ? 's' : ''} requer${criticalCount === 1 ? '' : 'em'} resolução manual`
              : 'Conflitos detectados que precisam de resolução'
            }
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Lista de conflitos */}
          <div className="space-y-3">
            {conflicts.map((conflict, index) => (
              <Card 
                key={conflict.id} 
                className={`border-l-4 ${
                  conflict.severity === 'critical' ? 'border-l-red-500' : 
                  conflict.severity === 'high' ? 'border-l-orange-500' : 
                  conflict.severity === 'medium' ? 'border-l-yellow-500' : 
                  'border-l-blue-500'
                } bg-slate-800/50 cursor-pointer hover:bg-slate-800/70 transition-colors`}
                onClick={() => setSelectedConflict(selectedConflict?.id === conflict.id ? null : conflict)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {getTypeIcon(conflict.type)}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-slate-100 font-medium">{conflict.description}</h4>
                          <Badge variant={getSeverityColor(conflict.severity)} className="text-xs">
                            {getSeverityIcon(conflict.severity)}
                            {conflict.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-400 mt-1">
                          Tipo: {conflict.type} • {new Date(conflict.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Detalhes expandidos */}
                  {selectedConflict?.id === conflict.id && (
                    <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-900/50 p-3 rounded">
                          <h5 className="text-sm font-medium text-slate-300 mb-2">Estado Local</h5>
                          <pre className="text-xs text-slate-400 overflow-auto max-h-32">
                            {JSON.stringify(conflict.localValue, null, 2)}
                          </pre>
                        </div>
                        <div className="bg-slate-900/50 p-3 rounded">
                          <h5 className="text-sm font-medium text-slate-300 mb-2">Estado Servidor</h5>
                          <pre className="text-xs text-slate-400 overflow-auto max-h-32">
                            {JSON.stringify(conflict.serverValue, null, 2)}
                          </pre>
                        </div>
                      </div>

                      {/* Botões de resolução individual */}
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={() => onResolve(conflict.id, 'use_local')}
                          variant="outline"
                          size="sm"
                          className="bg-blue-600/20 border-blue-400/50 text-blue-300"
                        >
                          Usar Local
                        </Button>
                        <Button
                          onClick={() => onResolve(conflict.id, 'use_server')}
                          variant="outline"
                          size="sm"
                          className="bg-green-600/20 border-green-400/50 text-green-300"
                        >
                          Usar Servidor
                        </Button>
                        {conflict.type !== 'player_turn' && conflict.type !== 'game_status' && (
                          <Button
                            onClick={() => onResolve(conflict.id, 'merge')}
                            variant="outline"
                            size="sm"
                            className="bg-purple-600/20 border-purple-400/50 text-purple-300"
                          >
                            Tentar Merge
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Ações em lote */}
          <div className="border-t border-slate-700 pt-4">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => onResolveAll('use_server')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Shield className="w-4 h-4 mr-2" />
                Usar Servidor para Todos
              </Button>
              <Button
                onClick={() => onResolveAll('use_local')}
                variant="outline"
                className="bg-blue-600/20 border-blue-400/50 text-blue-300"
              >
                Usar Local para Todos
              </Button>
              <Button
                onClick={onDismiss}
                variant="ghost"
                className="text-slate-400 hover:text-slate-300"
              >
                Ignorar Conflitos
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConflictResolutionDialog;
