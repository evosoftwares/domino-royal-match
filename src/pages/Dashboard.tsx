import React from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import WalletBalance from '@/components/wallet/WalletBalance';
import TransactionForm from '@/components/wallet/TransactionForm';
import TransactionHistory from '@/components/wallet/TransactionHistory';
import { LogOut, User } from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { wallet, transactions, loading } = useWallet();

  return (
    // O fundo gradiente ocupa toda a altura da tela
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      {/* Container principal com espaçamento responsivo */}
      <div className="container mx-auto px-4 py-6 sm:py-8">
        
        {/* Cabeçalho: ajusta para coluna em telas pequenas e linha em telas médias */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4 sm:gap-0">
          <div className="flex items-center space-x-3">
            <User className="h-8 w-8 text-white" />
            <div>
              {/* Título com tamanho de fonte responsivo */}
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Olá, {user?.name}!
              </h1>
              <p className="text-purple-200 text-sm sm:text-base">
                Bem-vindo à sua carteira digital
              </p>
            </div>
          </div>
          <Button
            onClick={logout}
            variant="outline"
            size="sm"
            className="text-white border-white hover:bg-white hover:text-purple-900 group" // Adicionado 'group' para o hover do ícone
          >
            {/* O ícone herda a cor do botão e muda no hover */}
            <LogOut className="h-4 w-4 mr-2" /> 
            {/* O texto 'Sair' fica oculto em telas muito pequenas (<640px) */}
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>

        {/* Card de Saldo */}
        <div className="mb-8">
          <WalletBalance 
            balance={wallet?.balance || 0} 
            loading={loading} 
          />
        </div>

        {/* Conteúdo Principal: grid de 1 coluna em mobile, 2 em desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Formulário de Transação */}
          <div>
            <TransactionForm />
          </div>

          {/* Histórico de Transações */}
          <div>
            <TransactionHistory 
              transactions={transactions}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;