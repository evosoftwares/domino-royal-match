import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, Transaction, TransactionCreate } from '@/types/wallet';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export const useWallet = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingTransaction, setProcessingTransaction] = useState(false);

  const loadWallet = useCallback(async () => {
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao carregar carteira: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadTransactions = useCallback(async () => {
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error('Erro ao carregar transações: ' + errorMessage);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadWallet();
      loadTransactions();
    }
  }, [user, loadWallet, loadTransactions]);

  const executeAtomicTransaction = async (
    type: 'deposit' | 'withdrawal' | 'payment',
    amount: number,
    description: string
  ): Promise<boolean> => {
    if (!user || !wallet || amount <= 0) {
      toast.error('Dados inválidos para a transação');
      return false;
    }

    if ((type === 'withdrawal' || type === 'payment') && amount > wallet.balance) {
      toast.error('Saldo insuficiente');
      return false;
    }

    setProcessingTransaction(true);
    
    let transactionId: string | null = null;
    let compensationNeeded = false;
    
    try {
      // Step 1: Create transaction record first (as a lock/audit trail)
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: type,
          amount: amount,
          description: description
        })
        .select()
        .single();

      if (transactionError) throw transactionError;
      transactionId = transaction.id.toString();

      // Step 2: Calculate new balance
      const balanceChange = type === 'deposit' ? amount : -amount;
      const newBalance = wallet.balance + balanceChange;

      if (newBalance < 0) {
        throw new Error('Transação resultaria em saldo negativo');
      }

      // Step 3: Update profile balance with optimistic concurrency control
      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .update({ 
          balance: newBalance, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', user.id)
        .eq('balance', wallet.balance) // Optimistic concurrency control
        .select('balance')
        .single();

      if (profileError) {
        compensationNeeded = true;
        throw new Error(`Erro na atualização do saldo: ${profileError.message}`);
      }

      if (!updatedProfile) {
        compensationNeeded = true;
        throw new Error('Conflito de concorrência detectado. Tente novamente.');
      }

      // Success: Update local state
      setWallet(prev => prev ? { ...prev, balance: newBalance } : null);
      
      const newTransaction: Transaction = {
        id: transactionId,
        wallet_id: user.id,
        type: type,
        amount: amount,
        description: description,
        status: 'completed',
        created_at: transaction.created_at || new Date().toISOString()
      };
      
      setTransactions(prev => [newTransaction, ...prev]);
      
      const actionText = type === 'deposit' ? 'adicionados à' : 
                        type === 'withdrawal' ? 'sacados da' : 'debitados da';
      toast.success(`R$ ${amount.toFixed(2)} ${actionText} carteira!`);
      return true;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Compensation: Remove transaction record if balance update failed
      if (compensationNeeded && transactionId) {
        try {
          await supabase
            .from('transactions')
            .delete()
            .eq('id', parseInt(transactionId));
        } catch (compensationError) {
          console.error('Error in compensation transaction:', compensationError);
        }
      }
      
      toast.error('Erro na transação: ' + errorMessage);
      
      // ✅ ADDED: Reload wallet state on error to ensure consistency
      await loadWallet();
      return false;
    } finally {
      setProcessingTransaction(false);
    }
  };

  const addFunds = async (amount: number, description: string = 'Depósito') => {
    if (amount <= 0 || amount > 10000) {
      toast.error('Valor inválido. Deve ser entre R$ 0,01 e R$ 10.000,00');
      return false;
    }
    
    return executeAtomicTransaction('deposit', amount, description);
  };

  const withdrawFunds = async (amount: number, description: string = 'Saque') => {
    if (amount <= 0 || amount > 10000) {
      toast.error('Valor inválido. Deve ser entre R$ 0,01 e R$ 10.000,00');
      return false;
    }
    
    return executeAtomicTransaction('withdrawal', amount, description);
  };

  const makePayment = async (amount: number, description: string) => {
    if (amount <= 0 || amount > 10000) {
      toast.error('Valor inválido. Deve ser entre R$ 0,01 e R$ 10.000,00');
      return false;
    }
    
    if (!description || description.trim().length < 3) {
      toast.error('Descrição do pagamento é obrigatória');
      return false;
    }
    
    return executeAtomicTransaction('payment', amount, description);
  };

  const refreshWallet = async () => {
    setLoading(true);
    await Promise.all([loadWallet(), loadTransactions()]);
  };

  return {
    wallet,
    transactions,
    loading: loading || processingTransaction,
    processingTransaction,
    addFunds,
    withdrawFunds,
    makePayment,
    loadTransactions,
    refreshWallet,
  };
};
