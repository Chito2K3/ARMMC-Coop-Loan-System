'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Loan } from '@/lib/types';

interface SalaryInputPanelProps {
  onSelectLoan: (loanId: string) => void;
  selectedLoanId: string | null;
}

export function SalaryInputPanel({ onSelectLoan, selectedLoanId }: SalaryInputPanelProps) {
  const firestore = useFirestore();

  const loansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'loans'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: allLoans } = useCollection<Loan>(loansQuery);

  const pendingLoans = useMemo(() => {
    if (!allLoans) return [];
    return allLoans.filter(loan => loan.status === 'pending' && (!loan.salary || loan.salary === 0));
  }, [allLoans]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Input Salary</CardTitle>
        <CardDescription>{pendingLoans.length} loans need salary input</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {pendingLoans.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No loans pending salary input</p>
          ) : (
            pendingLoans.map(loan => (
              <button
                key={loan.id}
                onClick={() => onSelectLoan(loan.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedLoanId === loan.id
                    ? 'bg-primary/10 border-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <div className="font-medium">{loan.applicantName}</div>
                <div className="text-sm text-muted-foreground">
                  ₱{loan.amount.toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
