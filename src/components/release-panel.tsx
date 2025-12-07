'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { format } from 'date-fns';
import type { Loan } from '@/lib/types';

interface ReleasePanelProps {
  onSelectLoan: (loanId: string) => void;
  selectedLoanId: string | null;
}

export function ReleasePanel({ onSelectLoan, selectedLoanId }: ReleasePanelProps) {
  const firestore = useFirestore();

  const loansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'loans'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: allLoans } = useCollection<Loan>(loansQuery);

  const loansForRelease = useMemo(() => {
    if (!allLoans) return [];
    return allLoans.filter(loan => loan.status === 'approved');
  }, [allLoans]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>For Releasing</CardTitle>
        <CardDescription>{loansForRelease.length} approved loans</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {loansForRelease.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No loans ready for release</p>
          ) : (
            loansForRelease.map(loan => (
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
                  Approved: {format(loan.updatedAt instanceof Date ? loan.updatedAt : loan.updatedAt.toDate(), 'MMM dd, yyyy')}
                </div>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}