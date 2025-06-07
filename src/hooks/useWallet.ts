
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, Transaction, TransactionCreate } from '@/types/wallet';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export const useWallet = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadWallet();
      loadTransactions();
    }
  }, [user]);

  const loadWallet = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        // Criar carteira se não existir
        await createWallet();
      } else {
        setWallet(data);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar carteira: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('wallets')
        .insert({
          user_id: user.id,
          balance: 0
        })
        .select()
        .single();

      if (error) throw error;
      setWallet(data);
    } catch (error: any) {
      toast.error('Erro ao criar carteira: ' + error.message);
    }
  };

  const loadTransactions = async () => {
    if (!user || !wallet) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar transações: ' + error.message);
    }
  };

  const addFunds = async (amount: number, description: string = 'Depósito') => {
    if (!wallet || amount <= 0) return false;

    try {
      setLoading(true);
      
      // Criar transação
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          wallet_id: wallet.id,
          type: 'deposit',
          amount: amount,
          description: description,
          status: 'completed'
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Atualizar saldo da carteira
      const newBalance = wallet.balance + amount;
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', wallet.id);

      if (walletError) throw walletError;

      setWallet({ ...wallet, balance: newBalance });
      setTransactions(prev => [transaction, ...prev]);
      
      toast.success(`R$ ${amount.toFixed(2)} adicionados à carteira!`);
      return true;
    } catch (error: any) {
      toast.error('Erro ao adicionar fundos: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const withdrawFunds = async (amount: number, description: string = 'Saque') => {
    if (!wallet || amount <= 0 || amount > wallet.balance) {
      toast.error('Saldo insuficiente');
      return false;
    }

    try {
      setLoading(true);
      
      // Criar transação
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          wallet_id: wallet.id,
          type: 'withdrawal',
          amount: amount,
          description: description,
          status: 'completed'
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Atualizar saldo da carteira
      const newBalance = wallet.balance - amount;
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', wallet.id);

      if (walletError) throw walletError;

      setWallet({ ...wallet, balance: newBalance });
      setTransactions(prev => [transaction, ...prev]);
      
      toast.success(`R$ ${amount.toFixed(2)} sacados da carteira!`);
      return true;
    } catch (error: any) {
      toast.error('Erro ao sacar fundos: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const makePayment = async (amount: number, description: string) => {
    if (!wallet || amount <= 0 || amount > wallet.balance) {
      toast.error('Saldo insuficiente');
      return false;
    }

    try {
      setLoading(true);
      
      // Criar transação
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          wallet_id: wallet.id,
          type: 'payment',
          amount: amount,
          description: description,
          status: 'completed'
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Atualizar saldo da carteira
      const newBalance = wallet.balance - amount;
      const { error: walletError } = await supabase
        .from('wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', wallet.id);

      if (walletError) throw walletError;

      setWallet({ ...wallet, balance: newBalance });
      setTransactions(prev => [transaction, ...prev]);
      
      toast.success(`Pagamento de R$ ${amount.toFixed(2)} realizado!`);
      return true;
    } catch (error: any) {
      toast.error('Erro ao realizar pagamento: ' + error.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    wallet,
    transactions,
    loading,
    addFunds,
    withdrawFunds,
    makePayment,
    loadTransactions
  };
};
