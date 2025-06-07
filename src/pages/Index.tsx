
import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import MatchmakingQueue from "@/components/MatchmakingQueue";
import UserBalance from "@/components/UserBalance";
import { User, LogOut } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-8">
        {/* Header Mobile Optimized */}
        <div className="flex flex-col space-y-4 mb-6 sm:flex-row sm:justify-between sm:items-center sm:space-y-0 sm:mb-8">
          <div className="flex items-center justify-center sm:justify-start">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Dominó Multiplayer
            </h1>
          </div>
          
          {/* User info and logout - Styled */}
          <div className="flex items-center justify-between sm:justify-center space-x-3">
            {/* User info with elegant background - Now clickable */}
            <div 
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-600/20 to-purple-500/20 backdrop-blur-sm border border-purple-400/30 rounded-full px-3 py-2 sm:px-4 sm:py-2 cursor-pointer hover:bg-purple-500/30 transition-all duration-200"
              onClick={() => navigate('/profile')}
            >
              <div className="bg-purple-500/80 rounded-full p-1.5">
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
              </div>
              <span className="text-white text-sm sm:text-base font-medium truncate max-w-[100px] sm:max-w-[150px]">
                {user?.name}
              </span>
            </div>
            
            {/* Logout button */}
            <Button
              onClick={logout}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-purple-500/20 border border-purple-400/30 rounded-full px-3 py-2 transition-all duration-200 hover:border-purple-300/50"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-2 sm:hidden">Sair</span>
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-6 sm:space-y-8">
          {/* Description */}
          <div className="text-center">
            <p className="text-purple-200 text-base sm:text-lg mb-4 sm:mb-6 px-2">
              Jogue dominó em tempo real com amigos
            </p>
            
            {/* User Balance - Mobile optimized with click to dashboard */}
            <div className="flex justify-center mb-4 sm:mb-8">
              <div 
                className="w-full max-w-sm sm:max-w-none cursor-pointer transition-transform duration-200 hover:scale-105"
                onClick={() => navigate('/dashboard')}
              >
                <UserBalance />
              </div>
            </div>
          </div>

          {/* Matchmaking - Full width on mobile */}
          <div className="flex justify-center px-2 sm:px-0">
            <div className="w-full max-w-md sm:max-w-none">
              <MatchmakingQueue />
            </div>
          </div>

          {/* Instructions - Mobile optimized */}
          <div className="mx-2 sm:max-w-2xl sm:mx-auto mt-8 sm:mt-12 p-4 sm:p-6 bg-gradient-to-r from-purple-900/30 to-black/30 rounded-xl sm:rounded-2xl border border-purple-600/20">
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-6 text-center">
              Como Funciona
            </h3>
            
            {/* Mobile: Stack vertically, Desktop: Grid */}
            <div className="space-y-6 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
              <div className="text-center p-3 sm:p-0">
                <div className="text-2xl sm:text-3xl mb-2">1️⃣</div>
                <h4 className="text-white font-medium mb-2 text-sm sm:text-base">
                  Entre na Fila
                </h4>
                <p className="text-purple-300 text-xs sm:text-sm leading-relaxed">
                  Clique em "Entrar em Partida" e aguarde outros jogadores
                </p>
              </div>
              
              <div className="text-center p-3 sm:p-0 border-y border-purple-600/20 sm:border-y-0">
                <div className="text-2xl sm:text-3xl mb-2">2️⃣</div>
                <h4 className="text-white font-medium mb-2 text-sm sm:text-base">
                  Partida Formada
                </h4>
                <p className="text-purple-300 text-xs sm:text-sm leading-relaxed">
                  Quando 4 jogadores estiverem prontos, a partida inicia automaticamente
                </p>
              </div>
              
              <div className="text-center p-3 sm:p-0">
                <div className="text-2xl sm:text-3xl mb-2">3️⃣</div>
                <h4 className="text-white font-medium mb-2 text-sm sm:text-base">
                  Jogue e Ganhe
                </h4>
                <p className="text-purple-300 text-xs sm:text-sm leading-relaxed">
                  O vencedor leva o prêmio total de R$ 4,00
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom spacing for mobile */}
        <div className="h-4 sm:h-0"></div>
      </div>
    </div>
  );
};

export default Index;
