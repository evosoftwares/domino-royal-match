import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { RegisterCredentials } from '@/types/auth';
import { toast } from 'sonner'; // Importando o toast

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
  // Novo estado para verificar se as senhas são diferentes
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
    
    // Validações com toasts
    if (credentials.password !== confirmPassword) {
      toast.error('As senhas não coincidem. Por favor, verifique.');
      return;
    }

    if (credentials.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    const success = await register(credentials);
    if (success) {
      // O hook 'register' já deve exibir o toast de sucesso/erro
      onSwitchToLogin();
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
          {/* Campo Nome Completo (sem alterações) */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input id="name" name="name" type="text" placeholder="Seu nome completo" value={credentials.name} onChange={handleChange} required />
          </div>

          {/* Campo Email (sem alterações) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="seu@email.com" value={credentials.email} onChange={handleChange} required />
          </div>
          
          {/* Campo Senha */}
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" type="password" placeholder="••••••••" value={credentials.password} onChange={handleChange} required minLength={6} />
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
              // Adiciona uma borda vermelha se as senhas não baterem
              className={passwordsDoNotMatch ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
            {passwordsDoNotMatch && (
              <p className="text-xs text-red-600">As senhas não coincidem.</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading || passwordsDoNotMatch}>
            {loading ? 'Criando conta...' : 'Criar Conta'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Já tem uma conta?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-primary hover:underline"
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