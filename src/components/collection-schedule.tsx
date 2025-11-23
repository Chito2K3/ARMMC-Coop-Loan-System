'use client';

import * as React from 'react';
import {
  collection,
  doc,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { differenceInDays, format } from 'date-fns';
import { Calendar as CalendarIcon, Undo2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { Loan, Payment } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

interface CollectionScheduleProps {
  loan: Loan;
}

const formatCurrency = (value: number) => {
  if (isNaN(value) || value === 0) return '₱0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PHP',
  }).format(value);
};

const PENALTY_AMOUNT = 500;
const GRACE_PERIOD_DAYS = 3;

export function CollectionSchedule({ loan }: CollectionScheduleProps) {
  const firestore = useFirestore();

  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'loans', loan.id, 'payments'),
      orderBy('paymentNumber', 'asc')
    );
  }, [firestore, loan.id]);

  const { data: rawPayments, isLoading } = useCollection<Payment>(paymentsQuery);

  const payments = React.useMemo(() => {
    if (!rawPayments) return [];
    return rawPayments.map((p) => ({
      ...p,
      dueDate: (p.dueDate as Timestamp).toDate(),
      paymentDate: p.paymentDate ? (p.paymentDate as Timestamp).toDate() : undefined,
    }));
  }, [rawPayments]);

  const handleDateChange = (paymentId: string, date: Date | undefined) => {
    if (!firestore || !date) return;

    const paymentRef = doc(firestore, 'loans', loan.id, 'payments', paymentId);
    updateDocumentNonBlocking(paymentRef, {
      paymentDate: Timestamp.fromDate(date),
      status: 'paid',
      updatedAt: serverTimestamp(),
    });

    toast({
      title: 'Payment Date Updated',
      description: 'The payment has been marked as paid.',
    });
    
    // Check if all payments are now paid
    const allPaid = payments.every(p => {
      // The current payment is being updated, so its state in `payments` array is old.
      // We count it as paid for this check.
      if (p.id === paymentId) return true;
      // Check the status of all other payments.
      return p.status === 'paid';
    });

    if (allPaid) {
      const loanRef = doc(firestore, 'loans', loan.id);
      updateDocumentNonBlocking(loanRef, { status: 'fully-paid' });
      toast({
        title: 'Loan Fully Paid!',
        description: 'Congratulations! This loan has been fully paid.',
        className: 'bg-green-100 text-green-800 border-green-200'
      });
    }
  };
  
  const handleWaivePenalty = (paymentId: string) => {
    if (!firestore) return;
    const paymentRef = doc(firestore, 'loans', loan.id, 'payments', paymentId);
    updateDocumentNonBlocking(paymentRef, {
      penaltyWaived: true,
      updatedAt: serverTimestamp(),
    });
    toast({
      title: 'Penalty Waived',
      description: 'The penalty for this payment has been waived.',
    });
  };

  const getPaymentStatus = (payment: (typeof payments)[0]) => {
    const dueDate = payment.dueDate;
    const paymentDate = payment.paymentDate;

    if (payment.status === 'paid' && paymentDate) {
      const isLate = differenceInDays(paymentDate, dueDate) > GRACE_PERIOD_DAYS;
      return isLate ? (
        <Badge variant="destructive">Paid (Late)</Badge>
      ) : (
        <Badge className="bg-green-600 hover:bg-green-700">Paid</Badge>
      );
    }

    const isOverdue = differenceInDays(new Date(), dueDate) > GRACE_PERIOD_DAYS;
    return isOverdue ? (
      <Badge variant="destructive">Late</Badge>
    ) : (
      <Badge variant="outline">Pending</Badge>
    );
  };

  const calculatePenalty = (payment: (typeof payments)[0]) => {
    if (payment.penaltyWaived) return 0;
    
    const dueDate = payment.dueDate;
    const paymentDate = payment.paymentDate;
    
    if (paymentDate) { // If it's paid
      const isLate = differenceInDays(paymentDate, dueDate) > GRACE_PERIOD_DAYS;
      return isLate ? PENALTY_AMOUNT : 0;
    } else { // If it's not paid yet
      const isOverdue = differenceInDays(new Date(), dueDate) > GRACE_PERIOD_DAYS;
      return isOverdue ? PENALTY_AMOUNT : 0;
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Collection Schedule</CardTitle>
        <CardDescription>
          Manage monthly payments, penalties, and payment dates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96 w-full rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Penalty</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <>
                  <TableRow>
                    <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                </>
              )}
              {!isLoading && payments.length === 0 && (
                 <TableRow>
                 <TableCell colSpan={7} className="h-24 text-center">
                   No payment schedule found.
                 </TableCell>
               </TableRow>
              )}
              {payments.map((payment) => {
                const penalty = calculatePenalty(payment);
                return(
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    {payment.paymentNumber}
                  </TableCell>
                  <TableCell>{format(payment.dueDate, 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-[200px] justify-start text-left font-normal',
                            !payment.paymentDate && 'text-muted-foreground'
                          )}
                          disabled={loan.status === 'fully-paid'}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {payment.paymentDate ? (
                            format(payment.paymentDate, 'MMM d, yyyy')
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={payment.paymentDate}
                          onSelect={(date) => handleDateChange(payment.id, date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell>{getPaymentStatus(payment)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell
                    className={cn('text-right font-medium', penalty > 0 && 'text-destructive')}
                  >
                    {formatCurrency(penalty)}
                  </TableCell>
                  <TableCell className="text-center">
                    {penalty > 0 && !payment.penaltyWaived && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleWaivePenalty(payment.id)}
                        title="Waive Penalty"
                        disabled={loan.status === 'fully-paid'}
                      >
                       <Undo2 className="h-4 w-4" />
                        <span className="sr-only">Waive Penalty</span>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
