'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import type { Loan } from '@/lib/types';

interface ApprovalPanelProps {
  onSelectLoan: (loanId: string) => void;
  selectedLoanId: string | null;
}

export function ApprovalPanel({ onSelectLoan, selectedLoanId }: ApprovalPanelProps) {
  const firestore = useFirestore();

  const loansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'loans'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: allLoans, error: loansError } = useCollection<Loan>(loansQuery);

  const pendingLoans = useMemo(() => {
    if (!allLoans) return [];
    return allLoans.filter(loan => loan.status === 'pending');
  }, [allLoans]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>For Approval</CardTitle>
        <CardDescription>{pendingLoans.length} pending loans</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {loansError && (
            <p className="text-center text-destructive py-8">Failed to load loans</p>
          )}
          {pendingLoans.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No loans pending approval</p>
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
                <div className="text-xs text-muted-foreground mt-1">
                  Created At: {format(loan.createdAt instanceof Date ? loan.createdAt : loan.createdAt.toDate(), 'MMM dd, yyyy')}
                </div>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
