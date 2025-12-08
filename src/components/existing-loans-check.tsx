"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import type { Loan, Payment } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, TrendingDown, AlertTriangle, XCircle } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import { Badge } from "./ui/badge";
import { Timestamp, Firestore } from "firebase/firestore";
import { differenceInDays } from "date-fns";
import * as React from "react";

interface ExistingLoansCheckProps {
  applicantName: string;
  currentLoanId?: string;
}

interface PaymentMetrics {
  totalPayments: number;
  evaluatedPayments: number;
  paidOnTime: number;
  latePayments: number;
  pastDuePayments: number;
  totalPastDueAmount: number;
  totalActivePenalties: number;
  totalPenaltiesWaived: number;
  totalPenaltiesDenied: number;
  underpaymentCount: number;
  totalUnderpaymentAmount: number;
  complianceRate: number;
}

interface RiskLevel {
  level: "low" | "medium" | "high" | "critical";
  label: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  badgeColor: string;
  icon: React.ReactNode;
  explanation: string;
}

const calculatePaymentMetrics = (payments: Payment[]): PaymentMetrics => {
  const now = new Date();
  const GRACE_PERIOD_DAYS = 3;

  let paidOnTime = 0;
  let latePayments = 0;
  let pastDuePayments = 0;
  let totalPastDueAmount = 0;
  let totalActivePenalties = 0;
  let totalPenaltiesWaived = 0;
  let totalPenaltiesDenied = 0;
  let underpaymentCount = 0;
  let totalUnderpaymentAmount = 0;
  let evaluatedPayments = 0;

  payments.forEach((payment) => {
    const dueDate = payment.dueDate instanceof Date ? payment.dueDate : (payment.dueDate as Timestamp).toDate();
    const paymentDate = payment.paymentDate ? (payment.paymentDate instanceof Date ? payment.paymentDate : (payment.paymentDate as Timestamp).toDate()) : null;
    const daysUntilDue = differenceInDays(dueDate, now);

    // Only evaluate payments where due date has passed or is within grace period
    if (daysUntilDue <= GRACE_PERIOD_DAYS) {
      evaluatedPayments++;

      if (paymentDate) {
        const daysDifference = differenceInDays(paymentDate, dueDate);
        if (daysDifference < GRACE_PERIOD_DAYS) {
          paidOnTime++;
        } else {
          latePayments++;
        }
      } else {
        const daysOverdue = differenceInDays(now, dueDate);
        if (daysOverdue > GRACE_PERIOD_DAYS) {
          pastDuePayments++;
          totalPastDueAmount += payment.amount;
        }
      }
    }

    // Count underpayments
    if (payment.actualAmountPaid && payment.actualAmountPaid < payment.amount) {
      underpaymentCount++;
      totalUnderpaymentAmount += payment.amount - payment.actualAmountPaid;
    }

    // Count penalties: only active penalties (not waived or denied)
    if (payment.penalty && payment.penalty > 0) {
      if (payment.penaltyWaived) {
        totalPenaltiesWaived += payment.penalty;
      } else if (payment.penaltyDenied) {
        totalPenaltiesDenied += payment.penalty;
      } else {
        // Active penalty (not waived, not denied)
        totalActivePenalties += payment.penalty;
      }
    }
  });

  const complianceRate = evaluatedPayments > 0 ? Math.round((paidOnTime / evaluatedPayments) * 100) : 100;

  return {
    totalPayments: payments.length,
    evaluatedPayments,
    paidOnTime,
    latePayments,
    pastDuePayments,
    totalPastDueAmount,
    totalActivePenalties,
    totalPenaltiesWaived,
    totalPenaltiesDenied,
    underpaymentCount,
    totalUnderpaymentAmount,
    complianceRate,
  };
};

const calculateRiskLevel = (metrics: PaymentMetrics): RiskLevel => {
  // Critical: Current past due amount > 0 OR any past due payments
  if (metrics.pastDuePayments > 0 || metrics.totalPastDueAmount > 0) {
    return {
      level: "critical",
      label: "Critical",
      borderColor: "border-destructive/40",
      bgColor: "bg-destructive/5",
      textColor: "text-destructive",
      badgeColor: "bg-destructive text-destructive-foreground",
      icon: <XCircle className="h-5 w-5 text-destructive" />,
      explanation: "Applicant has past due payments. High default risk.",
    };
  }

  // High: 3+ late payments OR active penalties denied OR compliance < 50%
  if (metrics.latePayments >= 3 || metrics.totalPenaltiesDenied > 0 || metrics.complianceRate < 50) {
    return {
      level: "high",
      label: "High",
      borderColor: "border-orange-500/40",
      bgColor: "bg-orange-500/5",
      textColor: "text-orange-700",
      badgeColor: "bg-orange-500 text-white",
      icon: <AlertTriangle className="h-5 w-5 text-orange-600" />,
      explanation: "Multiple late payments or deferred penalties. Elevated risk.",
    };
  }

  // Medium: 1-2 late payments OR active penalties OR compliance 50-80%
  if (metrics.latePayments >= 1 || metrics.totalActivePenalties > 0 || metrics.complianceRate < 80) {
    return {
      level: "medium",
      label: "Medium",
      borderColor: "border-amber-500/40",
      bgColor: "bg-amber-500/5",
      textColor: "text-amber-700",
      badgeColor: "bg-amber-500 text-white",
      icon: <AlertCircle className="h-5 w-5 text-amber-600" />,
      explanation: "Some late payments or active penalties. Moderate risk.",
    };
  }

  // Low: No issues (no past due, no late payments, no active penalties)
  return {
    level: "low",
    label: "Low",
    borderColor: "border-primary/30",
    bgColor: "bg-primary/5",
    textColor: "text-primary",
    badgeColor: "bg-primary text-primary-foreground",
    icon: <TrendingDown className="h-5 w-5 text-primary" />,
    explanation: "Clean payment history. Low risk.",
  };
};

export function ExistingLoansCheck({
  applicantName,
  currentLoanId,
}: ExistingLoansCheckProps) {
  const firestore = useFirestore();
  const [paymentMetrics, setPaymentMetrics] = React.useState<PaymentMetrics | null>(null);
  const [isLoadingPayments, setIsLoadingPayments] = React.useState(false);

  const shouldQuery = !!(firestore && applicantName);

  const existingLoansQuery = useMemoFirebase(() => {
    if (!shouldQuery) return null;
    return query(
      collection(firestore, "loans"),
      where("applicantName", "==", applicantName),
      where("status", "in", ["pending", "approved", "released"])
    );
  }, [firestore, applicantName, shouldQuery]);

  const { data: loans, isLoading } = useCollection<Loan>(existingLoansQuery);

  const existingLoans = useMemoFirebase(
    () => loans?.filter((loan) => loan.id !== currentLoanId),
    [loans, currentLoanId]
  );

  // Fetch payment history for all existing loans
  React.useEffect(() => {
    if (!firestore || !existingLoans || existingLoans.length === 0) {
      setPaymentMetrics(null);
      return;
    }

    const fetchPaymentHistory = async () => {
      setIsLoadingPayments(true);
      try {
        const allPayments: Payment[] = [];

        for (const loan of existingLoans) {
          const paymentsRef = collection(firestore, "loans", loan.id, "payments");
          const paymentsQuery = query(paymentsRef, orderBy("paymentNumber", "asc"));
          const snapshot = await getDocs(paymentsQuery);

          snapshot.docs.forEach((doc) => {
            allPayments.push({ id: doc.id, ...doc.data() } as Payment);
          });
        }

        const metrics = calculatePaymentMetrics(allPayments);
        setPaymentMetrics(metrics);
      } catch (error) {
        console.error("Error fetching payment history:", error);
        setPaymentMetrics(null);
      } finally {
        setIsLoadingPayments(false);
      }
    };

    fetchPaymentHistory();
  }, [firestore, existingLoans]);

  if (!shouldQuery) {
    return null;
  }

  if (isLoading || isLoadingPayments) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!existingLoans || existingLoans.length === 0) {
    return null;
  }

  const totalDebt = existingLoans.reduce((sum, loan) => sum + loan.amount, 0);
  const riskLevel = paymentMetrics ? calculateRiskLevel(paymentMetrics) : null;

  return (
    <Card className={`border-2 shadow-md ${riskLevel?.borderColor} ${riskLevel?.bgColor}`}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {riskLevel?.icon}
            <div>
              <CardTitle className={riskLevel?.textColor}>
                Risk Alert: {riskLevel?.label} Risk
              </CardTitle>
              <CardDescription>
                Applicant has {existingLoans.length} active loan(s) totaling ₱{totalDebt.toLocaleString()}
              </CardDescription>
            </div>
          </div>
          {riskLevel && (
            <Badge className={riskLevel.badgeColor}>
              {riskLevel.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing Loans */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">Active Loans</p>
          {existingLoans.map((loan) => (
            <div key={loan.id} className="flex items-center justify-between p-2 bg-background rounded border border-primary/10">
              <div className="flex-1">
                <p className="text-sm font-medium">Loan #{loan.loanNumber}</p>
                <p className="text-xs text-muted-foreground">{loan.loanType}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">₱{loan.amount.toLocaleString()}</p>
                <Badge variant="outline" className="text-xs mt-1">
                  {loan.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Payment History Summary */}
        {paymentMetrics && paymentMetrics.evaluatedPayments > 0 && (
          <div className="space-y-2 pt-2 border-t border-primary/10">
            <p className="text-sm font-semibold">Payment History (Due Payments)</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-background rounded border border-primary/10">
                <p className="text-muted-foreground">On-Time Payments</p>
                <p className="font-semibold">{paymentMetrics.paidOnTime}/{paymentMetrics.evaluatedPayments}</p>
              </div>
              <div className="p-2 bg-background rounded border border-primary/10">
                <p className="text-muted-foreground">Compliance Rate</p>
                <p className="font-semibold">{paymentMetrics.complianceRate}%</p>
              </div>
              {paymentMetrics.latePayments > 0 && (
                <div className="p-2 bg-background rounded border border-orange-500/30">
                  <p className="text-muted-foreground">Late Payments</p>
                  <p className="font-semibold text-orange-600">{paymentMetrics.latePayments}</p>
                </div>
              )}
              {paymentMetrics.pastDuePayments > 0 && (
                <div className="p-2 bg-background rounded border border-destructive/30">
                  <p className="text-muted-foreground">Past Due</p>
                  <p className="font-semibold text-destructive">₱{paymentMetrics.totalPastDueAmount.toLocaleString()}</p>
                </div>
              )}
              {paymentMetrics.totalActivePenalties > 0 && (
                <div className="p-2 bg-background rounded border border-destructive/30">
                  <p className="text-muted-foreground">Active Penalties</p>
                  <p className="font-semibold text-destructive">₱{paymentMetrics.totalActivePenalties.toLocaleString()}</p>
                </div>
              )}
              {paymentMetrics.totalPenaltiesWaived > 0 && (
                <div className="p-2 bg-background rounded border border-primary/10">
                  <p className="text-muted-foreground">Penalties Waived</p>
                  <p className="font-semibold">₱{paymentMetrics.totalPenaltiesWaived.toLocaleString()}</p>
                </div>
              )}
              {paymentMetrics.totalPenaltiesDenied > 0 && (
                <div className="p-2 bg-background rounded border border-orange-500/30">
                  <p className="text-muted-foreground">Penalties Deferred</p>
                  <p className="font-semibold text-orange-600">₱{paymentMetrics.totalPenaltiesDenied.toLocaleString()}</p>
                </div>
              )}
              {paymentMetrics.underpaymentCount > 0 && (
                <div className="p-2 bg-background rounded border border-amber-500/30">
                  <p className="text-muted-foreground">Underpayments</p>
                  <p className="font-semibold text-amber-600">{paymentMetrics.underpaymentCount} (₱{paymentMetrics.totalUnderpaymentAmount.toLocaleString()})</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Risk Explanation */}
        <div className={`p-3 rounded border ${riskLevel?.borderColor} ${riskLevel?.bgColor}`}>
          <p className={`text-xs font-semibold mb-1 ${riskLevel?.textColor}`}>Risk Assessment:</p>
          <p className="text-xs text-foreground">{riskLevel?.explanation}</p>
        </div>

        {/* Risk Level Definitions */}
        <div className="pt-2 border-t border-primary/10 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Risk Level Definitions (Based on Due Payments):</p>
          <div className="space-y-1 text-xs">
            <p><span className="font-semibold text-primary">Low:</span> No past due, no late payments, no active penalties</p>
            <p><span className="font-semibold text-amber-600">Medium:</span> 1-2 late payments OR active penalties OR compliance 50-80%</p>
            <p><span className="font-semibold text-orange-600">High:</span> 3+ late payments OR deferred penalties OR compliance &lt;50%</p>
            <p><span className="font-semibold text-destructive">Critical:</span> Any past due payments or past due amount &gt; 0</p>
          </div>
        </div>

        <p className="text-xs text-foreground pt-2 border-t border-primary/10">
          ⚠️ Review borrower's total debt burden and payment history before approving new loans.
        </p>
      </CardContent>
    </Card>
  );
}
