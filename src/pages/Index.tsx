
import React from 'react';
import MatchmakingQueue from "@/components/MatchmakingQueue";
import UserBalance from "@/components/UserBalance";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Dominó Multiplayer
          </h1>
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
