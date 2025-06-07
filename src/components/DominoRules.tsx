import React from 'react';
import { 
  Users, 
  CircleDollarSign, 
  PlayCircle, 
  GanttChartSquare, 
  Trophy, 
  ListOrdered 
} from 'lucide-react';

interface RuleSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

// Componente de Seção com tamanhos ajustados para mobile
const RuleSection: React.FC<RuleSectionProps> = ({ icon, title, children }) => (
  // ANTES: p-6
  <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 p-4 sm:p-6 rounded-[28px] sm:rounded-[34px] mb-6 shadow-lg transition-all hover:border-amber-400/50 hover:scale-[1.02]">
    <div className="flex items-center mb-4">
      {icon}
      {/* ANTES: text-2xl */}
      <h2 className="text-xl md:text-2xl font-semibold text-amber-400 ml-3 sm:ml-4">{title}</h2>
    </div>
    <div className="text-gray-300 space-y-3 leading-relaxed text-sm sm:text-base">
      {children}
    </div>
  </div>
);

const DominoRules: React.FC = () => {
  return (
    // ANTES: p-8 md:p-12 | my-10
    <div className="bg-gray-800 bg-gradient-to-br from-gray-800 to-gray-900 text-white p-4 sm:p-6 md:p-8 rounded-[32px] md:rounded-[40px] font-sans max-w-4xl mx-auto my-4 shadow-2xl border border-gray-700">
      
      {/* ANTES: mb-12 */}
      <header className="text-center mb-8 md:mb-12">
        {/* ANTES: text-4xl md:text-5xl */}
        <h1 className="text-3xl md:text-5xl font-bold text-amber-300 mb-2 tracking-wide">
          DOMINÓ MULTIPLAYER
        </h1>
        {/* ANTES: text-lg */}
        <p className="text-gray-400 text-base sm:text-lg">
          Guia Completo de Regras e Mecânicas
        </p>
      </header>
      
      <main className="space-y-6 md:space-y-8">

        <RuleSection 
          // ANTES: w-10 h-10
          icon={<Users className="w-8 h-8 md:w-10 md:h-10 text-amber-400 flex-shrink-0" />}
          title="1. Configuração Básica"
        >
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Componentes:</strong> 28 peças (0-0 a 6-6).</li>
            <li><strong>Jogadores:</strong> Exatamente 4 por partida.</li>
            <li><strong>Distribuição:</strong> 6 peças aleatórias e ocultas por jogador.</li>
            <li><strong>Peças Sobressalentes:</strong> 4 peças não são utilizadas na rodada.</li>
            <li><strong>Plataforma:</strong> Sincronização em tempo real via Supabase.</li>
          </ul>
        </RuleSection>

        <RuleSection 
          icon={<CircleDollarSign className="w-8 h-8 md:w-10 md:h-10 text-amber-400 flex-shrink-0" />}
          title="2. Sistema Financeiro"
        >
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Aposta Obrigatória:</strong> R$ 1,00 por jogador.</li>
            <li><strong>Prêmio Total:</strong> R$ 4,00 por partida.</li>
            <li><strong>Taxa de Manutenção:</strong> R$ 0,10 (10 centavos) descontados do prêmio.</li>
            <li><strong>Prêmio Líquido:</strong> R$ 3,90 para o vencedor.</li>
            <li><strong>Requisito Mínimo:</strong> R$ 2,00 em moedas para entrar.</li>
            <li><strong>Pagamentos:</strong> Saque instantâneo e desconto automático das moedas.</li>
          </ul>
        </RuleSection>

        <RuleSection 
          icon={<PlayCircle className="w-8 h-8 md:w-10 md:h-10 text-amber-400 flex-shrink-0" />}
          title="3. Início do Jogo"
        >
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Primeiro Jogador:</strong> Definido por sorteio. A peça de maior valor total inicia. Em caso de empate, a peça com a maior pontuação individual vence.</li>
            <li><strong>Ordem:</strong> Sentido horário a partir do primeiro jogador.</li>
            <li><strong>Início da Partida:</strong> O jogo só começa com 4 jogadores conectados.</li>
          </ul>
        </RuleSection>

        {/* ... (as demais seções seguirão o mesmo padrão de ícone responsivo) ... */}

        <RuleSection 
          icon={<GanttChartSquare className="w-8 h-8 md:w-10 md:h-10 text-amber-400 flex-shrink-0" />}
          title="4. Mecânica do Jogo"
        >
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Regra de Encaixe:</strong> As peças devem ser jogadas nas extremidades abertas, combinando os números.</li>
            <li><strong>Jogada Obrigatória:</strong> Se o jogador possui uma peça compatível, ele <strong className="text-red-400">DEVE</strong> obrigatoriamente jogá-la.</li>
            <li><strong>Tempo por Jogada:</strong> 10 segundos. Se o tempo esgotar, o sistema joga uma peça aleatória.</li>
            <li><strong>Inatividade:</strong> Inatividade contínua resulta em eliminação automática.</li>
          </ul>
        </RuleSection>

        <RuleSection 
          icon={<Trophy className="w-8 h-8 md:w-10 md:h-10 text-amber-400 flex-shrink-0" />}
          title="5. Condições de Término"
        >
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Vitória por Finalização:</strong> Ocorre quando um jogador encaixa sua última peça na mesa.</li>
            <li><strong>Jogo Trancado:</strong> Acontece quando nenhum dos 4 jogadores possui peças que possam ser encaixadas nas extremidades.</li>
          </ul>
        </RuleSection>

        <RuleSection 
          icon={<ListOrdered className="w-8 h-8 md:w-10 md:h-10 text-amber-400 flex-shrink-0" />}
          title="6. Critérios de Vitória"
        >
          <ol className="list-decimal list-inside space-y-2">
            <li><strong>Fim das Peças:</strong> Vence quem acabar as peças primeiro.</li>
            <li><strong>Menor Pontuação (Jogo Trancado):</strong> Vence quem tiver a menor soma de pontos nas peças restantes.</li>
            <li><strong>Menor Quantidade de Peças:</strong> Se a pontuação empatar, vence quem tiver menos peças.</li>
            <li><strong>Peça de Menor Valor:</strong> Se tudo empatar, vence quem tiver a peça de menor valor total.</li>
            <li><strong>Desempate Final:</strong> Persistindo o empate, o valor da metade superior da peça de menor valor define o vencedor.</li>
          </ol>
        </RuleSection>

      </main>
    </div>
  );
};

export default DominoRules;