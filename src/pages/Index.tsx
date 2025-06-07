
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header com navegação */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold text-white">
              Dominó Multiplayer
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              size="sm"
              className="text-white border-white hover:bg-white hover:text-purple-900"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Carteira
            </Button>
            
            <div className="flex items-center space-x-2 text-white">
              <User className="h-4 w-4" />
              <span className="text-sm">{user?.name}</span>
            </div>
            
            <Button
              onClick={logout}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Descrição */}
        <div className="text-center mb-8">
          <p className="text-purple-200 text-lg mb-6">
            Jogue dominó em tempo real com amigos
          </p>
          
          {/* User Balance */}
          <div className="flex justify-center mb-8">
            <UserBalance />
          </div>
        </div>

        {/* Matchmaking */}
        <div className="flex justify-center">
          <MatchmakingQueue />
        </div>

        {/* Instructions */}
        <div className="max-w-2xl mx-auto mt-12 p-6 bg-gradient-to-r from-purple-900/30 to-black/30 rounded-2xl border border-purple-600/20">
          <h3 className="text-xl font-semibold text-white mb-4 text-center">
            Como Funciona
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl mb-2">1️⃣</div>
              <h4 className="text-white font-medium mb-1">Entre na Fila</h4>
              <p className="text-purple-300 text-sm">
                Clique em "Entrar em Partida" e aguarde outros jogadores
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">2️⃣</div>
              <h4 className="text-white font-medium mb-1">Partida Formada</h4>
              <p className="text-purple-300 text-sm">
                Quando 4 jogadores estiverem prontos, a partida inicia automaticamente
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">3️⃣</div>
              <h4 className="text-white font-medium mb-1">Jogue e Ganhe</h4>
              <p className="text-purple-300 text-sm">
                O vencedor leva o prêmio total de R$ 4,00
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
