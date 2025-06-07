
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet2 } from 'lucide-react';

interface WalletBalanceProps {
  balance: number;
  loading: boolean;
}

const WalletBalance = ({ balance, loading }: WalletBalanceProps) => {
  return (
    <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
        <Wallet2 className="h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {loading ? '...' : `R$ ${balance.toFixed(2)}`}
        </div>
        <CardDescription className="text-green-100">
          Disponível para uso
        </CardDescription>
      </CardContent>
    </Card>
  );
};

export default WalletBalance;
