
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import UserBalance from '@/components/UserBalance';

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    full_name: '',
    avatar_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        setProfile({
          full_name: data?.full_name || '',
          avatar_url: data?.avatar_url || '',
        });
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        toast.error('Erro ao carregar perfil');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast.error('Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

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
            <Button
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              size="sm"
              className="text-purple-200 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
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

        {/* Profile Content */}
        <div className="max-w-2xl mx-auto">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardHeader>
              <CardTitle className="text-purple-200 text-center">Meu Perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="text-center text-purple-200">Carregando...</div>
              ) : (
                <>
                  <div className="flex justify-center">
                    <Avatar className="w-24 h-24">
                      <AvatarImage src={profile.avatar_url} alt="Avatar" />
                      <AvatarFallback className="bg-purple-600 text-white text-2xl">
                        {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="full_name" className="text-purple-200">Nome Completo</Label>
                      <Input
                        id="full_name"
                        value={profile.full_name}
                        onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                        className="bg-slate-800/50 border-slate-600/50 text-white"
                        placeholder="Seu nome completo"
                      />
                    </div>

                    <div>
                      <Label htmlFor="avatar_url" className="text-purple-200">URL do Avatar</Label>
                      <Input
                        id="avatar_url"
                        value={profile.avatar_url}
                        onChange={(e) => setProfile(prev => ({ ...prev, avatar_url: e.target.value }))}
                        className="bg-slate-800/50 border-slate-600/50 text-white"
                        placeholder="https://exemplo.com/avatar.jpg"
                      />
                    </div>

                    <div>
                      <Label className="text-purple-200">Email</Label>
                      <Input
                        value={user.email || ''}
                        disabled
                        className="bg-slate-700/50 border-slate-600/50 text-slate-300"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
