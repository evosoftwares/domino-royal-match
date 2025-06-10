
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { RegisterCredentials } from '@/types/auth';
import { toast } from 'sonner';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const RegisterForm = ({ onSwitchToLogin }: RegisterFormProps) => {
  const { register, loading } = useAuth();
  const [credentials, setCredentials] = useState<RegisterCredentials>({
    name: '',
    email: '',
    password: ''
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordsDoNotMatch, setPasswordsDoNotMatch] = useState(false);

  // Efeito para validar a confirmação de senha em tempo real
  useEffect(() => {
    if (confirmPassword && credentials.password !== confirmPassword) {
      setPasswordsDoNotMatch(true);
    } else {
      setPasswordsDoNotMatch(false);
    }
  }, [credentials.password, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações básicas
    if (!credentials.name.trim()) {
      toast.error('Nome é obrigatório.');
      return;
    }

    if (!credentials.email.trim()) {
      toast.error('Email é obrigatório.');
      return;
    }

    if (credentials.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (credentials.password !== confirmPassword) {
      toast.error('As senhas não coincidem. Por favor, verifique.');
      return;
    }

    const success = await register(credentials);
    if (success) {
      // Limpar o formulário após sucesso
      setCredentials({ name: '', email: '', password: '' });
      setConfirmPassword('');
      // Aguardar um pouco antes de trocar para login para o usuário ver a mensagem de sucesso
      setTimeout(() => {
        onSwitchToLogin();
      }, 2000);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Cadastro</CardTitle>
        <CardDescription>
          Crie sua conta para começar a usar a carteira digital
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campo Nome Completo */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input 
              id="name" 
              name="name" 
              type="text" 
              placeholder="Seu nome completo" 
              value={credentials.name} 
              onChange={handleChange} 
              required 
              className={!credentials.name.trim() && credentials.name !== '' ? 'border-red-500' : ''}
            />
          </div>

          {/* Campo Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              name="email" 
              type="email" 
              placeholder="seu@email.com" 
              value={credentials.email} 
              onChange={handleChange} 
              required 
            />
          </div>
          
          {/* Campo Senha */}
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input 
              id="password" 
              name="password" 
              type="password" 
              placeholder="••••••••" 
              value={credentials.password} 
              onChange={handleChange} 
              required 
              minLength={6}
              className={credentials.password.length > 0 && credentials.password.length < 6 ? 'border-red-500' : ''}
            />
            {credentials.password.length > 0 && credentials.password.length < 6 && (
              <p className="text-xs text-red-600">A senha deve ter pelo menos 6 caracteres.</p>
            )}
          </div>

          {/* Campo Confirmar Senha com feedback visual */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className={passwordsDoNotMatch ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
            {passwordsDoNotMatch && (
              <p className="text-xs text-red-600">As senhas não coincidem.</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || passwordsDoNotMatch || credentials.password.length < 6}
          >
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Já tem uma conta?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-primary hover:underline"
              disabled={loading}
            >
              Faça login
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RegisterForm;
