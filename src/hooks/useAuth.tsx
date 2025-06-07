
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, LoginCredentials, RegisterCredentials } from '@/types/auth';
import { toast } from 'sonner';

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
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          name: session.user.user_metadata?.name ?? '',
          created_at: session.user.created_at ?? ''
        });
      }
      setLoading(false);
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
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
      const { error } = await supabase.auth.signInWithPassword(credentials);
      if (error) {
        toast.error(error.message);
        return false;
      }
      toast.success('Login realizado com sucesso!');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (credentials: RegisterCredentials): Promise<boolean> => {
    setLoading(true);
    try {
      // Passo 1: Cadastrar o usuário
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            name: credentials.name
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Não foi possível criar o usuário.");

      // Passo 2: Criar o perfil público para o usuário
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        full_name: credentials.name,
        username: credentials.name.split(' ')[0].toLowerCase() + `-${authData.user.id.substring(0, 4)}`
      });

      if (profileError) {
         // Idealmente, a criação do perfil deveria ser uma transação atômica
         // ou um gatilho no banco, como sugerido anteriormente.
        throw new Error(`Conta criada, mas houve um erro ao criar o perfil: ${profileError.message}`);
      }

      toast.success('Conta criada com sucesso! Verifique seu email para confirmação.');
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logout realizado com sucesso!');
    } catch (error: any) {
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
