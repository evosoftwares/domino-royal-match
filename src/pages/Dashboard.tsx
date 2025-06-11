
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, User, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UserBalance from '@/components/UserBalance';

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
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

        {/* Dashboard Content */}
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="text-center">
                <CardTitle className="text-purple-200 flex items-center justify-center gap-2">
                  <Gamepad2 className="w-5 h-5" />
                  Jogar
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <Button 
                  onClick={() => navigate('/')}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Entrar na Fila
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader className="text-center">
                <CardTitle className="text-purple-200 flex items-center justify-center gap-2">
                  <User className="w-5 h-5" />
                  Perfil
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <Button 
                  onClick={() => navigate('/profile')}
                  variant="outline"
                  className="w-full bg-purple-900/50 border-purple-600/30 text-purple-200 hover:bg-purple-800/50"
                >
                  Ver Perfil
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
