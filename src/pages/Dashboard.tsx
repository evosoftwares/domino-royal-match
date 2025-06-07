
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import WalletBalance from '@/components/wallet/WalletBalance';
import TransactionForm from '@/components/wallet/TransactionForm';
import TransactionHistory from '@/components/wallet/TransactionHistory';
import DominoRules from '@/components/DominoRules';
import { LogOut, User, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { wallet, transactions, loading } = useWallet();
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-3">
            <User className="h-8 w-8 text-white" />
            <div>
              <h1 className="text-2xl font-bold text-white">
                Olá, {user?.name}!
              </h1>
              <p className="text-purple-200">
                Bem-vindo à sua carteira digital
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setShowRules(!showRules)}
              variant="outline"
              size="sm"
              className="text-white border-white hover:bg-white hover:text-purple-900"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              <span>Regras</span>
              {showRules ? (
                <ChevronUp className="h-4 w-4 ml-2" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-2" />
              )}
            </Button>
            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="text-white border-white hover:bg-white hover:text-purple-900"
            >
              <LogOut className="h-4 w-4 mr-2 text-white" />
              <span className="text-white">Sair</span>
            </Button>
          </div>
        </div>

        {/* Rules Section */}
        {showRules && (
          <div className="mb-8">
            <DominoRules />
          </div>
        )}

        {/* Balance Card */}
        <div className="mb-8">
          <WalletBalance 
            balance={wallet?.balance || 0} 
            loading={loading} 
          />
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Transaction Form */}
          <div>
            <TransactionForm />
          </div>

          {/* Transaction History */}
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
