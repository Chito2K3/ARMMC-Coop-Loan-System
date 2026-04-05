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
  TableFooter,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Loan } from '@/lib/types';
import { Loader2, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LoanComputationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan;
  onRelease: () => Promise<void>;
  isSubmitting: boolean;
  userRole?: string | null;
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
  userRole,
}: LoanComputationDialogProps) {
  const router = useRouter();
  
  const computation = useMemo(() => {
    if (!loan || !loan.paymentTerm || loan.paymentTerm <= 0 || !loan.amount)
      return null;

    const principal = loan.amount;
    const term = loan.paymentTerm;
    const interestRate = 0.015; // 1.5% diminishing

    const schedule: {
      month: number;
      beginningBalance: number;
      interest: number;
      principal: number;
      endingBalance: number;
    }[] = [];

    let beginningBalance = principal;
    let totalInterest = 0;
    
    // We drop the simple Math.floor(principal/term) because we will calculate principal dynamically per month based on a rounded total payment.
    const approximateMonthlyPrincipalPayment = principal / term;
    let totalPrincipalPaid = 0;

    for (let month = 1; month <= term; month++) {
      const interest = beginningBalance * interestRate;
      totalInterest += interest;

      let principalPayment = 0;
      let totalMonthlyPayment = 0;

      if (month === term) {
        // Last month: The principal payment is exactly whatever balance is remaining. 
        principalPayment = principal - totalPrincipalPaid;
        totalMonthlyPayment = principalPayment + interest;
      } else {
        // Normal month: Total Payment must be a clean, whole Peso.
        // Get exact theoretically perfect total, then round it to nearest integer.
        const exactTotalPayment = approximateMonthlyPrincipalPayment + interest;
        totalMonthlyPayment = Math.round(exactTotalPayment);
        
        // Principal is whatever is left over after satisfying the exact interest portion
        principalPayment = totalMonthlyPayment - interest;
      }
      
      const endingBalance = beginningBalance - principalPayment;

      schedule.push({
        month,
        beginningBalance: beginningBalance,
        interest: interest,
        principal: principalPayment,
        endingBalance: endingBalance < 0 ? 0 : endingBalance,
      });

      beginningBalance = endingBalance;
      totalPrincipalPaid += principalPayment;
    }
    
    // Average out the first month amortization to show in the UI summary
    const monthlyAmortizationPrincipal = Math.round(schedule[0]?.principal * 100) / 100 || 0;

    // Fees calculation
    const loanTermInYears = term / 12;
    const serviceCharge = principal * 0.06 * loanTermInYears; 
    const shareCapital = principal * 0.01;

    // First month deductions
    const firstMonthInterest = schedule[0].interest;

    // For single-payment loans, the amortization is not deducted from proceeds
    const firstMonthAmortizationDeduction = term === 1 ? 0 : monthlyAmortizationPrincipal;
    
    // Total deductions
    const outstandingBalance = loan.outstandingBalanceAtRenewal || 0;
    const totalDeductions =
      serviceCharge +
      shareCapital +
      firstMonthAmortizationDeduction +
      firstMonthInterest +
      outstandingBalance;

    const netProceeds = principal - totalDeductions;
    
    // For 1-month term, interest is deducted upfront, so it's not paid back in amortization.
    if (term === 1) {
      schedule[0].interest = 0;
    }

    return {
      principal,
      term,
      monthlyAmortization: monthlyAmortizationPrincipal,
      totalInterest,
      schedule: term > 1 ? schedule.slice(1) : schedule,
      serviceCharge,
      shareCapital,
      firstMonthAmortization: firstMonthAmortizationDeduction,
      firstMonthInterest,
      totalDeductions,
      netProceeds,
      loanTermInYears,
      outstandingBalance,
    };
  }, [loan]);

  if (!computation) return null;
  
  const handleRelease = async () => {
    try {
      await onRelease();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to release fund:', error);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-6xl max-h-[85vh] p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl">Loan Computation Details</DialogTitle>
          <DialogDescription className="text-base">
            A full breakdown of the loan for {loan.applicantName}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
          {/* Summary */}
          <div className="space-y-6">
            <h3 className="font-semibold text-xl">Loan Summary</h3>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">Loan Amount</span>
                <span className="font-medium">
                  {formatCurrency(computation.principal)}
                </span>
              </div>

              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">Payment Term</span>
                <span className="font-medium">{computation.term} months</span>
              </div>

              <div className="flex justify-between text-base">
                <div>
                  <span className="text-muted-foreground">Monthly Principal Portion</span>
                  <p className="text-xs text-muted-foreground">(excludes monthly interest)</p>
                </div>
                <span className="font-medium">
                  {formatCurrency(computation.monthlyAmortization)}
                </span>
              </div>

              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">
                  Interest Rate
                </span>
                <span className="font-medium">1.5% per month (diminishing)</span>
              </div>

              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">
                  Total Interest Over Term
                </span>
                <span className="font-medium">
                  {formatCurrency(computation.totalInterest)}
                </span>
              </div>

              <div className="flex justify-between font-semibold text-base border-t pt-3">
                <span className="">Total Deductions</span>
                <span className="text-orange-500">
                  {formatCurrency(computation.totalDeductions)}
                </span>
              </div>

              <div className="flex justify-between font-bold text-lg text-green-600">
                <span className="">Net Proceeds</span>
                <span>
                  {formatCurrency(computation.netProceeds)}
                </span>
              </div>
            </div>

            <h3 className="font-semibold text-xl pt-4">
              Loan Deductions
            </h3>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
               <div className="flex justify-between text-base">
                <span className="text-muted-foreground">
                  Service Charge (6% per year)
                </span>
                <span className="font-medium">
                  {formatCurrency(computation.serviceCharge)}
                </span>
              </div>

              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">Share Capital (1%)</span>
                <span className="font-medium">
                  {formatCurrency(computation.shareCapital)}
                </span>
              </div>
              
              <div className="flex justify-between text-base">
                <span className="text-muted-foreground">
                  First Month Interest (1.5%)
                </span>
                <span className="font-medium">
                  {formatCurrency(computation.firstMonthInterest)}
                </span>
              </div>

              {computation.term > 1 && (
                <div className="flex justify-between text-base">
                  <span className="text-muted-foreground">
                    First Month Principal (Deducted upfront)
                  </span>
                  <span className="font-medium">
                    {formatCurrency(computation.monthlyAmortization)}
                  </span>
                </div>
              )}

              {computation.outstandingBalance > 0 && (
                <div className="flex justify-between text-base pt-2 border-t border-dashed border-red-500/20">
                  <span className="text-red-500 font-medium">
                    Outstanding Balance (Deducted)
                  </span>
                  <span className="font-bold text-red-600">
                    - {formatCurrency(computation.outstandingBalance)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Monthly Payment Schedule */}
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-xl">Monthly Payment Schedule</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Total monthly deduction: Principal + Interest (1.5% per month on remaining balance)
              </p>
            </div>
            <ScrollArea className="h-80 w-full rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted">
                  <TableRow>
                    <TableHead className="w-16 text-sm">Month</TableHead>
                    <TableHead className="text-right text-sm">Beginning Balance</TableHead>
                    <TableHead className="text-right text-sm">Monthly Interest</TableHead>
                    <TableHead className="text-right text-sm">Principal Payment</TableHead>
                    <TableHead className="text-right text-sm font-bold text-primary">Total Monthly Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computation.schedule.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium text-sm">{row.month}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(row.beginningBalance)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(row.interest)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(row.principal)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-bold text-primary">
                        {formatCurrency(row.principal + row.interest)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="text-right font-medium">Total</TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatCurrency(
                        computation.schedule.reduce((total, row) => total + row.principal + row.interest, 0)
                      )}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between flex-row-reverse sm:flex-row pt-4">
           <Button variant="outline" onClick={() => onOpenChange(false)} className="text-sm px-4 py-1 h-auto">
            Close
          </Button>
          {loan.status === 'approved' && (
            <Button
              onClick={handleRelease}
              disabled={isSubmitting || userRole !== 'bookkeeper'}
              className={userRole !== 'bookkeeper' ? 'opacity-40' : ''}
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
