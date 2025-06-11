import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
const UserBalance: React.FC = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchBalance = async () => {
    try {
      const {
        data: user
      } = await supabase.auth.getUser();
      if (!user.user) return;
      const {
        data,
        error
      } = await supabase.from('profiles').select('balance').eq('id', user.user.id).single();
      if (error) throw error;
      setBalance(data?.balance || 0);
    } catch (error) {
      console.error('Erro ao buscar saldo:', error);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchBalance();

    // Subscrição para atualizações em tempo real do saldo
    const channel = supabase.channel('user-balance').on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'profiles'
    }, () => {
      fetchBalance();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  if (loading) {
    return <div className="flex items-center gap-2 text-purple-200">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Carregando...</span>
      </div>;
  }
  const hasMinimumBalance = (balance || 0) >= 2.20;
  return <div className="flex items-center gap-3">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${hasMinimumBalance ? 'bg-green-900/30 border-green-600/30 text-green-200' : 'bg-red-900/30 border-red-600/30 text-red-200'}`}>
        
        <span className="font-semibold">
          R$ {(balance || 0).toFixed(2)}
        </span>
      </div>
      
      {!hasMinimumBalance && <div className="text-xs text-red-300">
          Saldo insuficiente para jogar
        </div>}

      <Button variant="ghost" size="sm" onClick={fetchBalance} className="text-purple-300 hover:text-white">
        <RefreshCw className="w-4 h-4" />
      </Button>
    </div>;
};
export default UserBalance;