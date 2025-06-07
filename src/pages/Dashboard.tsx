// src/components/game/DominoRules.jsx
import React from 'react';
import { 
  Users, 
  CircleDollarSign, 
  PlayCircle, 
  GanttChartSquare, 
  Trophy, 
  ListOrdered 
} from 'lucide-react';

const RuleSection = ({ icon, title, children }) => (
  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 p-6 rounded-[34px] mb-6 shadow-lg">
    <div className="flex items-center mb-4">
      {icon}
      <h2 className="text-2xl font-semibold text-amber-400 ml-4">{title}</h2>
    </div>
    <div className="text-gray-300 space-y-3 leading-relaxed">
      {children}
    </div>
  </div>
);

const DominoRules = () => {
  return (
    <div className="bg-gray-800 bg-gradient-to-br from-gray-800 to-gray-900 text-white p-8 md:p-12 rounded-[40px] font-sans max-w-4xl mx-auto my-4 shadow-2xl border border-gray-700">
      <header className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-amber-300 mb-2 tracking-wide">
          DOMINÓ MULTIPLAYER
        </h1>
        <p className="text-gray-400 text-lg">
          Guia Completo de Regras e Mecânicas
        </p>
      </header>
      <main className="space-y-8">
        <RuleSection 
          icon={<Users className="w-10 h-10 text-amber-400" />}
          title="1. Configuração Básica"
        >
          <ul className="list-disc list-inside">
            <li><strong>Componentes:</strong> 28 peças (0-0 a 6-6).</li>
            <li><strong>Jogadores:</strong> Exatamente 4 por partida.</li>
            <li><strong>Distribuição:</strong> 6 peças aleatórias e ocultas por jogador.</li>
            <li><strong>Peças Sobressalentes:</strong> 4 peças não são utilizadas na rodada.</li>
            <li><strong>Plataforma:</strong> Sincronização em tempo real via Supabase.</li>
          </ul>
        </RuleSection>
        {/* ... (resto das seções de regras aqui) ... */}
      </main>
    </div>
  );
};

export default DominoRules;