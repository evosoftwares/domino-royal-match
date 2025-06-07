
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, User, Save } from 'lucide-react';

interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  phone: string;
}

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    id: '',
    username: '',
    full_name: '',
    avatar_url: '',
    bio: '',
    phone: ''
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Map the database fields to the Profile interface, providing defaults for missing fields
        setProfile({
          id: data.id,
          username: data.username || '',
          full_name: data.full_name || '',
          avatar_url: data.avatar_url || '',
          bio: '', // Default empty since this field doesn't exist in the profiles table
          phone: '' // Default empty since this field doesn't exist in the profiles table
        });
      } else {
        // Criar perfil se não existir
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user?.id,
            username: user?.name || '',
            full_name: user?.name || ''
          })
          .select()
          .single();

        if (createError) throw createError;
        if (newProfile) {
          setProfile({
            id: newProfile.id,
            username: newProfile.username || '',
            full_name: newProfile.full_name || '',
            avatar_url: newProfile.avatar_url || '',
            bio: '',
            phone: ''
          });
        }
      }
    } catch (error: any) {
      toast.error('Erro ao carregar perfil: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url
          // Note: bio and phone are not saved since they don't exist in the profiles table
        });

      if (error) throw error;

      toast.success('Perfil atualizado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao salvar perfil: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof Profile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black flex items-center justify-center">
        <div className="text-white">Carregando perfil...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-black">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="text-white hover:bg-purple-500/20"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold text-white">Editar Perfil</h1>
        </div>

        {/* Profile Form */}
        <div className="max-w-2xl mx-auto">
          <Card className="bg-white/5 backdrop-blur-lg border border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações do Perfil
              </CardTitle>
              <CardDescription className="text-purple-200">
                Atualize suas informações pessoais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white">
                  Nome de usuário
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={profile.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  placeholder="Seu nome de usuário"
                />
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-white">
                  Nome completo
                </Label>
                <Input
                  id="full_name"
                  type="text"
                  value={profile.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  placeholder="Seu nome completo"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">
                  Telefone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  placeholder="(11) 99999-9999"
                  disabled
                />
                <p className="text-xs text-gray-400">Campo desabilitado - não disponível no banco de dados</p>
              </div>

              {/* Avatar URL */}
              <div className="space-y-2">
                <Label htmlFor="avatar_url" className="text-white">
                  URL do Avatar
                </Label>
                <Input
                  id="avatar_url"
                  type="url"
                  value={profile.avatar_url}
                  onChange={(e) => handleInputChange('avatar_url', e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                  placeholder="https://exemplo.com/avatar.jpg"
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio" className="text-white">
                  Biografia
                </Label>
                <Textarea
                  id="bio"
                  value={profile.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60 min-h-[100px]"
                  placeholder="Conte um pouco sobre você..."
                  disabled
                />
                <p className="text-xs text-gray-400">Campo desabilitado - não disponível no banco de dados</p>
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
