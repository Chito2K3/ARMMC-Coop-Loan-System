'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import type { Loan } from '@/lib/types';
import { differenceInDays } from 'date-fns';
import { getPenaltySettings } from '@/firebase/penalty-service';

interface PenaltyItem {
  loanId: string;
  applicantName: string;
  paymentNumber: number;
  dueDate: Date;
  penaltyAmount: number;
  paymentId: string;
}

interface PenaltyPanelProps {
  onSelectLoan: (loanId: string) => void;
  selectedLoanId: string | null;
}

export function PenaltyPanel({ onSelectLoan, selectedLoanId }: PenaltyPanelProps) {
  const firestore = useFirestore();
  const [penalties, setPenalties] = useState<PenaltyItem[]>([]);

  const loansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'loans'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: loans } = useCollection<Loan>(loansQuery);

  useEffect(() => {
    const fetchPenalties = async () => {
      if (!loans || !firestore) {
        setPenalties([]);
        return;
      }

      let gracePeriod = 3;
      try {
        const settings = await getPenaltySettings(firestore);
        gracePeriod = settings.gracePeriodDays;
      } catch (e) {
        console.error('Failed to load penalty settings:', e);
      }

      const penaltyList: PenaltyItem[] = [];

      for (const loan of loans) {
        if (loan.status === 'released') {
          try {
            const paymentsRef = collection(firestore, 'loans', loan.id, 'payments');
            const snapshot = await getDocs(paymentsRef);

            snapshot.docs.forEach((doc) => {
              const payment = doc.data();
              // Logic: Include if 'pending' AND overdue, OR 'paid' AND paid late

              const dueDate = payment.dueDate?.toDate?.() || new Date(payment.dueDate);

              if (!isNaN(dueDate.getTime())) {
                const today = new Date();
                let isOverdue = false;

                if (payment.status === 'paid' && payment.paymentDate) {
                  const paymentDate = payment.paymentDate?.toDate?.() || new Date(payment.paymentDate);
                  isOverdue = differenceInDays(paymentDate, dueDate) > gracePeriod;
                } else if (payment.status === 'pending') {
                  isOverdue = differenceInDays(today, dueDate) > gracePeriod;
                }

                const penalty = isOverdue && !payment.penaltyWaived && !payment.penaltyDenied ? 500 : 0;

                if (penalty > 0) {
                  penaltyList.push({
                    loanId: loan.id,
                    applicantName: loan.applicantName,
                    paymentNumber: payment.paymentNumber,
                    dueDate,
                    penaltyAmount: penalty,
                    paymentId: doc.id,
                  });
                }
              }
            });
          } catch (err) {
            console.error(`Error fetching payments for loan ${loan.id}:`, err);
          }
        }
      }

      setPenalties(penaltyList.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime()));
    };

    fetchPenalties();
  }, [loans, firestore]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waive Penalty</CardTitle>
        <CardDescription>{penalties.length} pending penalty{penalties.length !== 1 ? 's' : ''}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {penalties.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending penalties</p>
          ) : (
            penalties.map((penalty) => (
              <button
                key={`${penalty.loanId}-${penalty.paymentId}`}
                onClick={() => onSelectLoan(penalty.loanId)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedLoanId === penalty.loanId
                    ? 'bg-primary/10 border-primary'
                    : 'border-border hover:bg-accent'
                  }`}
              >
                <div className="font-medium">{penalty.applicantName}</div>
                <div className="text-sm text-muted-foreground">
                  Payment #{penalty.paymentNumber} • ₱{penalty.penaltyAmount.toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
