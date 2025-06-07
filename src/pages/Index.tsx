import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import MatchmakingQueue from "@/components/MatchmakingQueue";
import UserBalance from "@/components/UserBalance";
import { Wallet, User, LogOut } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black text-white">
      <div className="container mx-auto px-4 py-6">

        {/* Header Responsivo */}
        <header className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Dominó Multiplayer
          </h1>
          
          <div className="flex items-center space-x-3 md:space-x-4">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              size="sm"
              className="text-white border-white hover:bg-white hover:text-purple-900"
            >
              <Wallet className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Carteira</span>
            </Button>
            
            <div className="flex items-center space-x-2 text-white">
              <User className="h-5 w-5" />
              <span className="text-sm font-medium">{user?.name}</span>
            </div>
            
            <Button
              onClick={logout}
              variant="ghost"
              size="icon" // Usar 'icon' para um botão mais compacto em todas as telas
              className="text-white hover:bg-white/20 rounded-full"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {/* Corpo Principal */}
        <main className="text-center">
          <p className="text-purple-200 text-lg md:text-xl mb-6">
            Jogue dominó em tempo real com amigos
          </p>
          
          {/* Container para Saldo e Fila - Centralizado e empilhado */}
          <div className="flex flex-col items-center justify-center space-y-4 mb-12">
            <UserBalance />
            <MatchmakingQueue />
          </div>
        </main>

        {/* Seção "Como Funciona" Responsiva */}
        <section className="max-w-3xl mx-auto mt-12 p-4 md:p-6 bg-black/20 rounded-2xl border border-purple-600/30">
          <h3 className="text-2xl font-semibold text-white mb-6 text-center">
            Como Funciona
          </h3>
          {/* Grid que se adapta: 1 coluna em mobile, 3 em telas médias+ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
            <div className="text-center flex flex-col items-center">
              <div className="text-4xl mb-3">1️⃣</div>
              <h4 className="text-lg font-medium text-white mb-2">Entre na Fila</h4>
              <p className="text-purple-300 text-sm max-w-xs">
                Clique para encontrar uma partida e aguarde outros jogadores.
              </p>
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="text-4xl mb-3">2️⃣</div>
              <h4 className="text-lg font-medium text-white mb-2">Partida Formada</h4>
              <p className="text-purple-300 text-sm max-w-xs">
                Quando 4 jogadores estiverem prontos, a partida inicia.
              </p>
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="text-4xl mb-3">3️⃣</div>
              <h4 className="text-lg font-medium text-white mb-2">Jogue e Ganhe</h4>
              <p className="text-purple-300 text-sm max-w-xs">
                O vencedor leva o prêmio total da aposta.
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Index;