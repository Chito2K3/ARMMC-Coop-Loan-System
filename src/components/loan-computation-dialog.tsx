'use client';

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Loan } from '@/lib/types';
import { Loader2, CheckCircle } from 'lucide-react';

interface LoanComputationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan;
  onRelease: () => Promise<void>;
  isSubmitting: boolean;
}

const formatCurrency = (value: number) => {
  if (isNaN(value)) return 'P0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PHP',
  }).format(value);
};

export function LoanComputationDialog({
  open,
  onOpenChange,
  loan,
  onRelease,
  isSubmitting,
}: LoanComputationDialogProps) {
  const computation = useMemo(() => {
    if (!loan || !loan.paymentTerm || loan.paymentTerm <= 0 || !loan.amount)
      return null;

    const principal = loan.amount;
    const term = loan.paymentTerm;
    const interestRate = 0.015; // 1.5% diminishing

    const monthlyAmortizationPrincipal = Math.round((principal / term) * 100) / 100;
    
    const schedule: {
      month: number;
      beginningBalance: number;
      interest: number;
      principal: number;
      endingBalance: number;
    }[] = [];

    let beginningBalance = principal;
    let totalInterest = 0;

    for (let month = 1; month <= term; month++) {
      const interest = beginningBalance * interestRate;
      totalInterest += interest;

      let principalPayment = monthlyAmortizationPrincipal;

      // On the last month, adjust the principal payment to ensure the balance is exactly 0
      if (month === term) {
        principalPayment = beginningBalance;
      }
      
      const endingBalance = beginningBalance - principalPayment;

      schedule.push({
        month,
        beginningBalance: beginningBalance,
        interest: interest,
        principal: principalPayment,
        endingBalance: endingBalance,
      });

      beginningBalance = endingBalance;
    }


    // Fixed fees
    const serviceCharge = principal * 0.06;
    const shareCapital = principal * 0.01;

    // First month deductions
    const firstMonthAmortization = monthlyAmortizationPrincipal;
    const firstMonthInterest = principal * interestRate;

    // Total deductions
    const totalDeductions =
      serviceCharge +
      shareCapital +
      firstMonthAmortization +
      firstMonthInterest;

    const netProceeds = principal - totalDeductions;

    return {
      principal,
      term,
      monthlyAmortization: monthlyAmortizationPrincipal,
      totalInterest,
      schedule,
      serviceCharge,
      shareCapital,
      firstMonthAmortization,
      firstMonthInterest,
      totalDeductions,
      netProceeds,
    };
  }, [loan]);

  if (!computation) return null;
  
  const handleRelease = async () => {
    await onRelease();
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Loan Computation Details</DialogTitle>
          <DialogDescription>
            A full breakdown of the loan for "{loan.applicantName}".
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Summary */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Summary</h3>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Principal Amount</span>
                <span className="font-medium">
                  {formatCurrency(computation.principal)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Term</span>
                <span className="font-medium">{computation.term} months</span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Monthly Amortization (Principal)
                </span>
                <span className="font-medium">
                  {formatCurrency(computation.monthlyAmortization)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Total Diminishing Interest
                </span>
                <span className="font-medium">
                  {formatCurrency(computation.totalInterest)}
                </span>
              </div>

              <div className="flex justify-between font-semibold">
                <span className="">Total Deductions</span>
                <span className="text-destructive">
                  {formatCurrency(computation.totalDeductions)}
                </span>
              </div>

              <div className="flex justify-between font-bold text-lg">
                <span className="">Net Proceeds</span>
                <span className="text-green-600">
                  {formatCurrency(computation.netProceeds)}
                </span>
              </div>
            </div>

            <h3 className="font-semibold text-lg pt-4">
              First Month Deductions
            </h3>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Service Charge (6%)
                </span>
                <span className="font-medium">
                  {formatCurrency(computation.serviceCharge)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Share Capital (1%)</span>
                <span className="font-medium">
                  {formatCurrency(computation.shareCapital)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  First Month Amortization
                </span>
                <span className="font-medium">
                  {formatCurrency(computation.firstMonthAmortization)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  First Month Interest
                </span>
                <span className="font-medium">
                  {formatCurrency(computation.firstMonthInterest)}
                </span>
              </div>
            </div>
          </div>

          {/* Amortization Schedule */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Amortization Schedule</h3>
            <ScrollArea className="h-96 w-full rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow>
                    <TableHead className="w-[50px]">Month</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computation.schedule.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">{row.month}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.beginningBalance)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.interest)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.principal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {loan.status === 'approved' && (
            <Button
              onClick={handleRelease}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Release Fund
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
