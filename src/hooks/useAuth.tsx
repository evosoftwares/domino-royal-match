
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, LoginCredentials, RegisterCredentials } from '@/types/auth';
import { toast } from 'sonner';
import { cleanupAuthState } from '@/utils/authCleanup';

// Define a interface para o valor do contexto de autenticação
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

// Cria o contexto com um valor inicial undefined
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define o provedor de autenticação
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            name: session.user.user_metadata?.name ?? '',
            created_at: session.user.created_at ?? ''
          });
        }
      } catch (error) {
        console.error('Erro ao buscar sessão:', error);
        cleanupAuthState();
      }
      setLoading(false);
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session);
      
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          name: session.user.user_metadata?.name ?? '',
          created_at: session.user.created_at ?? ''
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setLoading(true);
    try {
      // Limpa o estado de autenticação antes de fazer login
      cleanupAuthState();
      
      // Tenta fazer logout global primeiro
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continua mesmo se este passo falhar
        console.log('Global signout failed, continuing with login');
      }

      const { data, error } = await supabase.auth.signInWithPassword(credentials);
      
      if (error) {
        console.error('Erro de login:', error);
        toast.error(error.message);
        return false;
      }

      if (data.user) {
        toast.success('Login realizado com sucesso!');
        // Force refresh da página para garantir estado limpo
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('Erro no processo de login:', error);
      toast.error(error.message || 'Erro ao fazer login');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (credentials: RegisterCredentials): Promise<boolean> => {
    setLoading(true);
    try {
      // Limpa o estado antes de registrar
      cleanupAuthState();
      
      // Configurar a URL de redirecionamento para confirmação de email
      const redirectUrl = `${window.location.origin}/`;
      
      // Cadastrar o usuário - o trigger do banco criará automaticamente o perfil
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: credentials.name
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Não foi possível criar o usuário.");

      toast.success('Conta criada com sucesso! Verifique seu email para confirmação.');
      return true;
    } catch (error: any) {
      console.error('Erro ao registrar:', error);
      toast.error(error.message || 'Erro ao criar conta');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      // Limpa o estado primeiro
      cleanupAuthState();
      
      // Tenta fazer logout global
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Ignora erros de logout
        console.log('Logout error ignored:', err);
      }
      
      toast.success('Logout realizado com sucesso!');
      
      // Force refresh para estado limpo
      setTimeout(() => {
        window.location.href = '/auth';
      }, 500);
    } catch (error: any) {
      console.error('Erro ao fazer logout:', error);
      toast.error(error.message || 'Erro ao fazer logout');
    } finally {
      setLoading(false);
    }
  };
  
  // O valor que será fornecido para os componentes filhos
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

// Hook customizado para consumir o contexto de autenticação
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
