
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import DominoRules from '@/components/DominoRules';
import {
  LogOut,
  User,
  BookOpen,
  X,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Card de Saldo com funcionalidade de visibilidade
const ElegantWalletBalance = ({ balance }) => {
  const [isVisible, setIsVisible] = useState(true);
  const formattedBalance = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(balance);

  return (
    <section className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-medium text-purple-200">Saldo Disponível</h2>
        <Button variant="ghost" size="icon" onClick={() => setIsVisible(!isVisible)} className="h-8 w-8 text-purple-200 hover:text-white">
          {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
        </Button>
      </div>
      <p className="text-3xl md:text-4xl font-bold text-white tracking-tighter">
        {isVisible ? formattedBalance : 'R$ ••••••'}
      </p>
    </section>
  );
};

// Histórico de transações com design melhorado
const ElegantTransactionHistory = ({ transactions, loading }) => {
    const getTransactionIcon = (amount) => {
      if (amount > 0) {
        return <div className="p-2 bg-green-900/50 rounded-full"><ArrowDownLeft size={16} className="text-green-400" /></div>;
      }
      return <div className="p-2 bg-red-900/50 rounded-full"><ArrowUpRight size={16} className="text-red-400" /></div>;
    };
  
    const formatTransactionDate = (date) => {
        return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    };

    return (
      <section className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl h-full">
        <div className="p-6">
          <h2 className="font-semibold text-white text-lg">Histórico de Transações</h2>
        </div>
        <div className="px-6 pb-6 space-y-4 max-h-[400px] md:max-h-[500px] overflow-y-auto">
          {loading ? (
            <p className="text-purple-200 text-center py-4">Carregando...</p>
          ) : transactions.length > 0 ? (
            transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  {getTransactionIcon(tx.amount)}
                  <div>
                    <p className="font-semibold text-white">{tx.description}</p>
                    <p className="text-xs text-purple-300">{formatTransactionDate(tx.created_at)}</p>
                  </div>
                </div>
                <p className={`font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.amount > 0 ? '+' : ''}
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-purple-200 text-center py-4">Nenhuma transação encontrada.</p>
          )}
        </div>
      </section>
    );
  };

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { wallet, transactions: realTransactions, loading } = useWallet();
  const sampleTransactions = [
      { id: 1, amount: 250.0, description: 'Depósito via PIX', created_at: '2025-06-07T12:30:00Z', type: 'deposit'},
      { id: 2, amount: -4.0, description: 'Partida de Dominó #1234', created_at: '2025-06-07T11:00:00Z', type: 'payment'},
      { id: 3, amount: -50.0, description: 'Saque para conta', created_at: '2025-06-06T18:00:00Z', type: 'withdraw'},
      { id: 4, amount: 3.90, description: 'Prêmio Partida #1200', created_at: '2025-06-05T22:15:00Z', type: 'prize'},
  ];
  const transactions = realTransactions.length > 0 ? realTransactions : sampleTransactions;

  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900 bg-gradient-to-br from-purple-900 via-slate-900 to-black text-white font-sans">
      <div className="container mx-auto px-4 py-6 md:py-10">
        
        <header className="flex flex-col sm:flex-row justify-between items-center mb-8 md:mb-12 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/50 flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Olá, {user?.name || 'Jogador'}!</h1>
              <p className="text-sm text-purple-300">Pronto para a próxima partida?</p>
            </div>
          </div>
         
        </header>

        <main className="space-y-8">
          {/* Seção de Regras Colapsável */}
          <section className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl">
            <button
              onClick={() => setIsRulesExpanded(!isRulesExpanded)}
              className="w-full p-6 flex items-center justify-between text-left hover:bg-white/5 transition-colors rounded-2xl"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-amber-400" />
                <div>
                  <h2 className="text-xl font-semibold text-white">Regras do Dominó</h2>
                  <p className="text-sm text-purple-300">Clique para ver o guia completo</p>
                </div>
              </div>
              {isRulesExpanded ? (
                <ChevronUp className="h-5 w-5 text-purple-300" />
              ) : (
                <ChevronDown className="h-5 w-5 text-purple-300" />
              )}
            </button>
            
            {isRulesExpanded && (
              <div className="px-6 pb-6">
                <div className="border-t border-white/10 pt-6">
                  <DominoRules />
                </div>
              </div>
            )}
          </section>

          {/* Grid Principal */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Coluna Esquerda: Ações Principais */}
            <div className="lg:col-span-2 space-y-8">
              <ElegantWalletBalance balance={wallet?.balance || 249.90} />
            </div>

            {/* Coluna Direita: Histórico */}
            <div className="lg:col-span-3">
              <ElegantTransactionHistory transactions={transactions} loading={loading} />
            </div>
          </div>
        </main>
      </div>

      {/* Modal de Regras com Transição */}
      {isRulesModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ease-in-out"
          onClick={() => setIsRulesModalOpen(false)}
        >
          <div 
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto p-2 transition-all duration-300 ease-in-out"
            onClick={(e) => e.stopPropagation()}
          >
            <DominoRules />

            <Button
              onClick={() => setIsRulesModalOpen(false)}
              variant="ghost"
              size="icon"
              className="absolute top-6 right-6 z-10 text-white bg-black/30 rounded-full hover:bg-white/20"
            >
              <X size={20} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
