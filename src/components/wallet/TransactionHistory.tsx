
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Transaction } from '@/types/wallet';
import { ArrowUpCircle, ArrowDownCircle, CreditCard, TrendingDown } from 'lucide-react';

interface TransactionHistoryProps {
  transactions: Transaction[];
  loading: boolean;
}

const TransactionHistory = ({ transactions, loading }: TransactionHistoryProps) => {
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownCircle className="h-4 w-4 text-green-500" />;
      case 'withdrawal':
        return <ArrowUpCircle className="h-4 w-4 text-red-500" />;
      case 'payment':
        return <CreditCard className="h-4 w-4 text-blue-500" />;
      case 'transfer':
        return <TrendingDown className="h-4 w-4 text-purple-500" />;
      default:
        return <CreditCard className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'Depósito';
      case 'withdrawal':
        return 'Saque';
      case 'payment':
        return 'Pagamento';
      case 'transfer':
        return 'Transferência';
      default:
        return type;
    }
  };

  const getAmountColor = (type: string) => {
    return type === 'deposit' ? 'text-green-600' : 'text-red-600';
  };

  const getAmountPrefix = (type: string) => {
    return type === 'deposit' ? '+' : '-';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Transações</CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Transações</CardTitle>
        <CardDescription>
          Suas últimas {transactions.length} transações
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhuma transação encontrada
          </p>
        ) : (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getTransactionIcon(transaction.type)}
                  <div>
                    <p className="font-medium">{transaction.description}</p>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        {getTransactionLabel(transaction.type)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${getAmountColor(transaction.type)}`}>
                    {getAmountPrefix(transaction.type)}R$ {transaction.amount.toFixed(2)}
                  </p>
                  <Badge 
                    variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                  >
                    {transaction.status === 'completed' ? 'Concluída' : 
                     transaction.status === 'pending' ? 'Pendente' : 'Falhou'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransactionHistory;
