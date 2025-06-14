
import React from 'react';
import { Activity, AlertTriangle, CheckCircle, XCircle, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface SystemHealthDashboardProps {
  healthStatus: {
    status: 'healthy' | 'warning' | 'critical';
    metrics: {
      memoryUsage: number;
      cpuTime: number;
      networkLatency: number;
      errorRate: number;
      uptime: number;
      lastHealthCheck: number;
    };
    alerts: {
      highMemoryUsage: boolean;
      highErrorRate: boolean;
      networkIssues: boolean;
      performanceDegradation: boolean;
    };
    recommendations: string[];
  };
  testResults?: {
    total: number;
    passed: number;
    failed: number;
    successRate: number;
    averageDuration: number;
  };
  isVisible: boolean;
  onClose: () => void;
}

const SystemHealthDashboard: React.FC<SystemHealthDashboardProps> = ({
  healthStatus,
  testResults,
  isVisible,
  onClose
}) => {
  if (!isVisible) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatUptime = (uptime: number) => {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const activeAlerts = Object.entries(healthStatus.alerts)
    .filter(([_, active]) => active)
    .map(([key, _]) => key);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900/95 rounded-lg border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-bold text-white">System Health Dashboard</h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Overall Status */}
          <Card className="mb-6 bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                {getStatusIcon(healthStatus.status)}
                System Status
                <Badge className={`${getStatusColor(healthStatus.status)} text-white`}>
                  {healthStatus.status.toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {healthStatus.metrics.memoryUsage.toFixed(1)}MB
                  </div>
                  <div className="text-sm text-slate-400">Memory Usage</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {healthStatus.metrics.networkLatency.toFixed(0)}ms
                  </div>
                  <div className="text-sm text-slate-400">Network Latency</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {healthStatus.metrics.errorRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-slate-400">Error Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">
                    {formatUptime(healthStatus.metrics.uptime)}
                  </div>
                  <div className="text-sm text-slate-400">Uptime</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Alerts */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Active Alerts ({activeAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeAlerts.length === 0 ? (
                  <div className="text-green-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    No active alerts
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeAlerts.map((alert) => (
                      <div key={alert} className="flex items-center gap-2 text-red-400">
                        <XCircle className="w-4 h-4" />
                        <span className="capitalize">{alert.replace(/([A-Z])/g, ' $1').trim()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Test Results */}
            {testResults && (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Integration Tests
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Success Rate</span>
                      <span className="text-white">{testResults.successRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={testResults.successRate} className="h-2" />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Tests Passed</span>
                      <span className="text-green-400">{testResults.passed}/{testResults.total}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Avg Duration</span>
                      <span className="text-white">{testResults.averageDuration.toFixed(1)}ms</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Recommendations */}
          <Card className="mt-6 bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {healthStatus.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-2 text-slate-300">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card className="mt-6 bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-slate-400 mb-1">Memory Usage</div>
                  <Progress 
                    value={Math.min((healthStatus.metrics.memoryUsage / 100) * 100, 100)} 
                    className="h-2" 
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    {healthStatus.metrics.memoryUsage.toFixed(1)}MB / 100MB
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-slate-400 mb-1">Error Rate</div>
                  <Progress 
                    value={Math.min(healthStatus.metrics.errorRate, 100)} 
                    className="h-2"
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    {healthStatus.metrics.errorRate.toFixed(1)}%
                  </div>
                </div>
                
                <div>
                  <div className="text-sm text-slate-400 mb-1">Network Latency</div>
                  <Progress 
                    value={Math.min((healthStatus.metrics.networkLatency / 3000) * 100, 100)} 
                    className="h-2"
                  />
                  <div className="text-xs text-slate-500 mt-1">
                    {healthStatus.metrics.networkLatency.toFixed(0)}ms
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthDashboard;
