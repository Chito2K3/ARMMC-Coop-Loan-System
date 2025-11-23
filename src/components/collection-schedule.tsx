'use client';

import { useMemo } from 'react';
import { addMonths, format } from 'date-fns';
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
import type { Loan } from '@/lib/types';

interface CollectionScheduleProps {
  loan: Loan;
}

const formatCurrency = (value: number) => {
  if (isNaN(value)) return 'P0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PHP',
  }).format(value);
};

export function CollectionSchedule({ loan }: CollectionScheduleProps) {
  const schedule = useMemo(() => {
    if (!loan.releasedAt || loan.paymentTerm <= 0) return [];

    // 1. Start one month after release date
    const baseDate = addMonths(new Date(loan.releasedAt), 1);
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const day = baseDate.getDate();

    // 2. Determine the first collection day (15th or 30th)
    let firstCollectionDay: number;
    let firstCollectionDate: Date;

    if (day <= 15) {
      firstCollectionDay = 15;
      firstCollectionDate = new Date(year, month, firstCollectionDay);
    } else {
      firstCollectionDay = 30;
      // Handle months with less than 30 days
      const tempDate = new Date(year, month, firstCollectionDay);
      if (tempDate.getMonth() !== month) {
        // Day overflowed, so use last day of correct month
        firstCollectionDate = new Date(year, month + 1, 0);
      } else {
        firstCollectionDate = tempDate;
      }
    }
    
    const monthlyPrincipal = loan.amount / loan.paymentTerm;

    const paymentSchedule = Array.from(
      { length: loan.paymentTerm },
      (_, i) => {
        const dueDate = addMonths(firstCollectionDate, i);
        
        // Ensure due date is always the same day, handling month-end
        const targetDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), firstCollectionDay);
        if (targetDate.getMonth() !== dueDate.getMonth()) {
            // Day overflowed (e.g. trying to set 30 on Feb), use last day of month
            dueDate.setDate(new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate());
        } else {
            dueDate.setDate(firstCollectionDay);
        }

        return {
          month: i + 1,
          dueDate: format(dueDate, 'MMM d, yyyy'),
          amount: monthlyPrincipal,
        };
      }
    );

    return paymentSchedule;
  }, [loan.releasedAt, loan.paymentTerm, loan.amount]);

  if (schedule.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collection Schedule</CardTitle>
        <CardDescription>
          Monthly principal collection dates and amounts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-72 w-full rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow>
                <TableHead className="w-[80px]">Payment</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.map((payment) => (
                <TableRow key={payment.month}>
                  <TableCell className="font-medium">{payment.month}</TableCell>
                  <TableCell>{payment.dueDate}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
