'use client';

import { useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import type { Loan } from '@/lib/types';
import { differenceInDays } from 'date-fns';

interface PastDuePayment {
  loanId: string;
  applicantName: string;
  dueDate: Date;
  daysOverdue: number;
  paymentNumber: number;
}

interface PastDuePanelProps {
  onSelectLoan: (loanId: string) => void;
  selectedLoanId: string | null;
}

export function PastDuePanel({ onSelectLoan, selectedLoanId }: PastDuePanelProps) {
  const firestore = useFirestore();
  const [pastDuePayments, setPastDuePayments] = useState<PastDuePayment[]>([]);

  const loansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'loans'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: loans } = useCollection<Loan>(loansQuery);

  useEffect(() => {
    const fetchPastDuePayments = async () => {
      if (!loans || !firestore) {
        setPastDuePayments([]);
        return;
      }

      const today = new Date();
      const overdue: PastDuePayment[] = [];

      for (const loan of loans) {
        if (loan.status === 'released') {
          try {
            const paymentsRef = collection(firestore, 'loans', loan.id, 'payments');
            const paymentsQuery = query(paymentsRef, where('status', '==', 'pending'));
            const snapshot = await getDocs(paymentsQuery);

            snapshot.docs.forEach((doc) => {
              const payment = doc.data();
              const dueDate = payment.dueDate?.toDate?.() || new Date(payment.dueDate);
              if (!isNaN(dueDate.getTime()) && dueDate < today && !payment.paymentDate) {
                const daysOverdue = differenceInDays(today, dueDate);
                overdue.push({
                  loanId: loan.id,
                  applicantName: loan.applicantName,
                  dueDate,
                  daysOverdue,
                  paymentNumber: payment.paymentNumber,
                });
              }
            });
          } catch (err) {
            console.error(`Error fetching payments for loan ${loan.id}:`, err);
          }
        }
      }

      setPastDuePayments(overdue.sort((a, b) => b.daysOverdue - a.daysOverdue));
    };

    fetchPastDuePayments();
  }, [loans, firestore]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Past Due</CardTitle>
        <CardDescription>{pastDuePayments.length} overdue payment{pastDuePayments.length !== 1 ? 's' : ''}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {pastDuePayments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No overdue payments</p>
          ) : (
            pastDuePayments.map((payment) => (
              <button
                key={`${payment.loanId}-${payment.paymentNumber}`}
                onClick={() => onSelectLoan(payment.loanId)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedLoanId === payment.loanId
                    ? 'bg-primary/10 border-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <div className="font-medium">{payment.applicantName}</div>
                <div className="text-sm text-muted-foreground">
                  Due: {payment.dueDate.toLocaleDateString()} • {payment.daysOverdue} days overdue
                </div>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
