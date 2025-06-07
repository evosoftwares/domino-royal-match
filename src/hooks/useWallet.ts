
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
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        // Convert profile data to wallet format
        const walletData: Wallet = {
          id: data.id,
          user_id: data.id,
          balance: data.balance,
          created_at: data.created_at,
          updated_at: data.updated_at || data.created_at
        };
        setWallet(walletData);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar carteira: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Convert database transactions to wallet transaction format
      const walletTransactions: Transaction[] = (data || []).map(tx => ({
        id: tx.id.toString(),
        wallet_id: user.id, // Use user_id as wallet_id
        type: tx.type as 'deposit' | 'withdrawal' | 'transfer' | 'payment',
        amount: tx.amount,
        description: tx.description || '',
        status: 'completed' as const, // All transactions in DB are completed
        created_at: tx.created_at || new Date().toISOString()
      }));
      
      setTransactions(walletTransactions);
    } catch (error: any) {
      toast.error('Erro ao carregar transações: ' + error.message);
    }
  };

  const addFunds = async (amount: number, description: string = 'Depósito') => {
    if (!wallet || amount <= 0) return false;

    try {
      setLoading(true);
      
      // Create transaction first
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          type: 'deposit',
          amount: amount,
          description: description
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Update profile balance
      const newBalance = wallet.balance + amount;
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          balance: newBalance, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      // Update local state
      setWallet({ ...wallet, balance: newBalance });
      
      // Add transaction to local state
      const newTransaction: Transaction = {
        id: transaction.id.toString(),
        wallet_id: user!.id,
        type: 'deposit',
        amount: amount,
        description: description,
        status: 'completed',
        created_at: transaction.created_at || new Date().toISOString()
      };
      
      setTransactions(prev => [newTransaction, ...prev]);
      
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
      
      // Create transaction first
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          type: 'withdrawal',
          amount: amount,
          description: description
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Update profile balance
      const newBalance = wallet.balance - amount;
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          balance: newBalance, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      // Update local state
      setWallet({ ...wallet, balance: newBalance });
      
      // Add transaction to local state
      const newTransaction: Transaction = {
        id: transaction.id.toString(),
        wallet_id: user!.id,
        type: 'withdrawal',
        amount: amount,
        description: description,
        status: 'completed',
        created_at: transaction.created_at || new Date().toISOString()
      };
      
      setTransactions(prev => [newTransaction, ...prev]);
      
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
      
      // Create transaction first
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          type: 'payment',
          amount: amount,
          description: description
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Update profile balance
      const newBalance = wallet.balance - amount;
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          balance: newBalance, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      // Update local state
      setWallet({ ...wallet, balance: newBalance });
      
      // Add transaction to local state
      const newTransaction: Transaction = {
        id: transaction.id.toString(),
        wallet_id: user!.id,
        type: 'payment',
        amount: amount,
        description: description,
        status: 'completed',
        created_at: transaction.created_at || new Date().toISOString()
      };
      
      setTransactions(prev => [newTransaction, ...prev]);
      
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
