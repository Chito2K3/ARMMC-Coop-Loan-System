"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Loan } from "@/lib/types";

interface LoanComputationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
  }).format(value);
};

export function LoanComputationDialog({
  open,
  onOpenChange,
  loan,
}: LoanComputationDialogProps) {
  const computation = useMemo(() => {
    if (!loan || !loan.paymentTerm || loan.paymentTerm <= 0) return null;

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

    const monthlyPrincipalPayment = principal / term;
    let beginningBalance = principal;
    let totalInterest = 0;
    
    for (let month = 1; month <= term; month++) {
      const interest = beginningBalance * interestRate;
      totalInterest += interest;

      const principalPayment = (month === term) 
        ? beginningBalance // Pay off remaining balance on the last month
        : monthlyPrincipalPayment;

      const endingBalance = beginningBalance - principalPayment;

      schedule.push({
        month,
        beginningBalance: parseFloat(beginningBalance.toFixed(2)),
        interest: parseFloat(interest.toFixed(2)),
        principal: parseFloat(principalPayment.toFixed(2)),
        endingBalance: parseFloat(endingBalance.toFixed(2)),
      });

      beginningBalance = endingBalance;
    }

    // Fixed fees
    const serviceCharge = principal * 0.06;
    const shareCapital = principal * 0.01;

    // First month deductions
    const firstMonthAmortization = monthlyPrincipalPayment;
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
      monthlyAmortization: monthlyPrincipalPayment,
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
                <span className="text-muted-foreground">Monthly Amortization (Principal)</span>
                <span className="font-medium">
                  {formatCurrency(computation.monthlyAmortization)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Diminishing Interest</span>
                <span className="font-medium">
                  {formatCurrency(computation.totalInterest)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="font-semibold">Total Deductions</span>
                <span className="font-semibold text-destructive">
                  {formatCurrency(computation.totalDeductions)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="font-bold text-lg">Net Proceeds</span>
                <span className="font-bold text-lg text-green-600">
                  {formatCurrency(computation.netProceeds)}
                </span>
              </div>
            </div>

            <h3 className="font-semibold text-lg pt-4">First Month Deductions</h3>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service Charge (6%)</span>
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
                <span className="text-muted-foreground">First Month Amortization</span>
                <span className="font-medium">
                  {formatCurrency(computation.firstMonthAmortization)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-muted-foreground">First Month Interest</span>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
