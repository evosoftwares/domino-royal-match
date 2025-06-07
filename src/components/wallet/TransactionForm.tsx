
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWallet } from '@/hooks/useWallet';

const TransactionForm = () => {
  const { addFunds, withdrawFunds, makePayment, loading } = useWallet();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (value > 0) {
      const success = await addFunds(value, description || 'Depósito');
      if (success) {
        setAmount('');
        setDescription('');
      }
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (value > 0) {
      const success = await withdrawFunds(value, description || 'Saque');
      if (success) {
        setAmount('');
        setDescription('');
      }
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (value > 0 && description) {
      const success = await makePayment(value, description);
      if (success) {
        setAmount('');
        setDescription('');
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operações</CardTitle>
        <CardDescription>
          Gerencie seus fundos e realize pagamentos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="deposit" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="deposit">Depositar</TabsTrigger>
            <TabsTrigger value="withdraw">Sacar</TabsTrigger>
            <TabsTrigger value="payment">Pagamento</TabsTrigger>
          </TabsList>
          
          <TabsContent value="deposit" className="space-y-4">
            <form onSubmit={handleAddFunds} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deposit-amount">Valor (R$)</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit-description">Descrição (opcional)</Label>
                <Input
                  id="deposit-description"
                  placeholder="Descrição do depósito"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Processando...' : 'Depositar'}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="withdraw" className="space-y-4">
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount">Valor (R$)</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="withdraw-description">Descrição (opcional)</Label>
                <Input
                  id="withdraw-description"
                  placeholder="Descrição do saque"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading} variant="destructive">
                {loading ? 'Processando...' : 'Sacar'}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="payment" className="space-y-4">
            <form onSubmit={handlePayment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-amount">Valor (R$)</Label>
                <Input
                  id="payment-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-description">Descrição *</Label>
                <Input
                  id="payment-description"
                  placeholder="Para que é este pagamento?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading} variant="secondary">
                {loading ? 'Processando...' : 'Realizar Pagamento'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TransactionForm;
