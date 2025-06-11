
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import MatchmakingQueue from '@/components/MatchmakingQueue';
import UserBalance from '@/components/UserBalance';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header com Logo */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <img 
              src="/lovable-uploads/cd2d3373-317b-49d5-bd6f-880dd6f2fa12.png" 
              alt="Dominó Money" 
              className="h-16 w-16 object-contain"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <UserBalance />
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="bg-purple-900/50 border-purple-600/30 text-purple-200 hover:bg-purple-800/50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>

        {/* Matchmaking Queue */}
        <div className="flex justify-center">
          <MatchmakingQueue />
        </div>
      </div>
    </div>
  );
};

export default Index;
