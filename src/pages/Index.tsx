
import GameRoom from "@/components/GameRoom";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Dominó Multiplayer
          </h1>
          <p className="text-purple-200 text-lg">
            Jogue dominó em tempo real com amigos
          </p>
        </div>
        <GameRoom />
      </div>
    </div>
  );
};

export default Index;
