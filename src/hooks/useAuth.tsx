// src/hooks/useAuth.tsx

import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, AuthResponse, LoginCredentials, RegisterCredentials } from '@/types/auth';
import { toast } from 'sonner';

// ... (interface e AuthContext permanecem os mesmos)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || '',
          created_at: session.user.created_at || ''
        });
      }
      setLoading(false);
    });

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || '',
            created_at: session.user.created_at || ''
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const register = async (credentials: RegisterCredentials): Promise<boolean> => {
    try {
      setLoading(true);
      // Passo 1: Cadastrar o usuário na autenticação
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            name: credentials.name
          }
        }
      });

      if (authError) {
        toast.error(authError.message);
        return false;
      }

      const registeredUser = authData.user;
      if (registeredUser) {
        // Passo 2: Inserir o perfil correspondente na tabela 'profiles'
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: registeredUser.id,
            full_name: credentials.name,
            // Gera um username único para evitar conflitos
            username: credentials.name.split(' ')[0].toLowerCase() + `-${registeredUser.id.substring(0, 4)}`
          });

        if (profileError) {
          // Embora o cadastro tenha ocorrido, o perfil falhou.
          // A solução com gatilho no DB evita este tipo de inconsistência.
          console.error('Falha ao criar perfil:', profileError);
          toast.error('Conta criada, mas houve um erro ao finalizar o perfil.');
          // Retorna true pois o usuário foi criado, mas informa o erro.
          return true;
        }

        toast.success('Conta criada com sucesso! Verifique seu email para confirmação.');
        return true;
      }

      return false;
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });

      if (error) {
        toast.error(error.message);
        return false;
      }

      if (data.user) {
        toast.success('Login realizado com sucesso!');
        return true;
      }

      return false;
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Logout realizado com sucesso!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer logout');
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};