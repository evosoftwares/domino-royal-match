
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

  console.log('AuthProvider iniciado - usuário:', user, 'carregando:', loading);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('Inicializando autenticação...');
        
        // Buscar sessão atual
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Erro ao buscar sessão:', error);
        } else if (session?.user) {
          console.log('Sessão encontrada:', session.user.email);
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            name: session.user.user_metadata?.name ?? '',
            created_at: session.user.created_at ?? ''
          });
        } else {
          console.log('Nenhuma sessão ativa encontrada');
        }
      } catch (error) {
        console.error('Erro fatal na inicialização da autenticação:', error);
      } finally {
        console.log('Finalizando inicialização da autenticação');
        setLoading(false);
      }
    };

    initializeAuth();

    // Listener para mudanças de estado de autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Mudança de estado de autenticação:', event, session?.user?.email);
        
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
      }
    );

    return () => {
      console.log('Limpando listener de autenticação');
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setLoading(true);
    
    try {
      console.log('Tentando fazer login com:', credentials.email);
      
      // Fazer login simples sem limpeza complexa
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });
      
      if (error) {
        console.error('Erro detalhado de login:', {
          message: error.message,
          status: error.status,
          details: error
        });
        
        // Mensagens de erro mais específicas em português
        let errorMessage = 'Erro ao fazer login';
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou senha incorretos';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Email não confirmado. Verifique sua caixa de entrada';
        } else if (error.message.includes('Too many requests')) {
          errorMessage = 'Muitas tentativas. Tente novamente em alguns minutos';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente';
        }
        
        toast.error(errorMessage);
        return false;
      }

      if (data.user) {
        console.log('Login realizado com sucesso:', data.user.email);
        toast.success('Login realizado com sucesso!');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('Erro de rede/conexão:', error);
      
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        toast.error('Erro de conexão. Verifique sua internet e tente novamente');
      } else {
        toast.error('Erro inesperado ao fazer login');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (credentials: RegisterCredentials): Promise<boolean> => {
    setLoading(true);
    
    try {
      console.log('Tentando registrar usuário:', credentials.email);
      
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: credentials.name
          }
        }
      });

      if (error) {
        console.error('Erro de registro:', error);
        
        let errorMessage = 'Erro ao criar conta';
        if (error.message.includes('User already registered')) {
          errorMessage = 'Este email já está cadastrado';
        } else if (error.message.includes('Password should be at least')) {
          errorMessage = 'A senha deve ter pelo menos 6 caracteres';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Email inválido';
        }
        
        toast.error(errorMessage);
        return false;
      }

      if (data.user) {
        console.log('Registro realizado com sucesso:', data.user.email);
        toast.success('Conta criada com sucesso! Verifique seu email para confirmação.');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('Erro ao registrar:', error);
      toast.error('Erro de conexão ao criar conta');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    
    try {
      console.log('Fazendo logout...');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Erro ao fazer logout:', error);
        toast.error('Erro ao fazer logout');
      } else {
        console.log('Logout realizado com sucesso');
        toast.success('Logout realizado com sucesso!');
        setUser(null);
      }
    } catch (error: any) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
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

  console.log('Valor do AuthProvider:', value);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook customizado para consumir o contexto de autenticação
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  
  console.log('useAuth chamado - contexto:', context);
  
  if (context === undefined) {
    console.error('useAuth deve ser usado dentro de um AuthProvider');
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};
