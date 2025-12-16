'use client';

import * as React from 'react';
import {
  Check,
  ChevronLeft,
  FilePenLine,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
  Calculator,
  ArrowRight,
  DollarSign,
  Banknote,
  ClipboardCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { addMonths, format } from 'date-fns';
import {
  doc,
  serverTimestamp,
  Timestamp,
  collection,
  writeBatch,
  Firestore,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

import {
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { getOrCreateUser } from '@/firebase/user-service';
import { toast } from '@/hooks/use-toast';
import type { Loan, LoanWrite, LoanSerializable, PaymentWrite } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { LoanFormSheet } from './loan-form-sheet';
import { ExistingLoansCheck } from './existing-loans-check';
import { LoanComputationDialog } from './loan-computation-dialog';
import { CollectionSchedule } from './collection-schedule';
import { useApprovalPanel } from './approval-context';

const generatePaymentSchedule = (loan: Loan, releasedAt: Date): PaymentWrite[] => {
  if (!releasedAt || loan.paymentTerm <= 0) return [];

  const principal = loan.amount;
  const term = loan.paymentTerm;
  const interestRate = 0.015; // 1.5% diminishing

  const monthlyPrincipalPayment = Math.floor(principal / term);
  let beginningBalance = principal;
  let totalPrincipalPaid = 0;

  const paymentSchedule: PaymentWrite[] = [];

  for (let i = 0; i < term; i++) {
    const month = i + 1;
    const interest = beginningBalance * interestRate;

    let principalPayment = monthlyPrincipalPayment;
    // Adjust last payment to ensure total principal is exact
    if (month === term) {
      principalPayment = principal - totalPrincipalPaid;
    }

    const totalAmount = principalPayment + interest;
    const dueDate = addMonths(releasedAt, month);

    paymentSchedule.push({
      loanId: loan.id,
      paymentNumber: month,
      dueDate: Timestamp.fromDate(dueDate),
      amount: totalAmount,
      status: 'pending',
      penalty: 0,
      penaltyWaived: false,
    });

    beginningBalance -= principalPayment;
    totalPrincipalPaid += principalPayment;
  }

  return paymentSchedule;
};

interface LoanDetailViewProps {
  loanId: string;
  onBack?: () => void;
}

export function LoanDetailView({ loanId, onBack }: LoanDetailViewProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const { showApprovalPanel, showSalaryInputPanel, showPastDuePanel, showPenaltyPanel, showReleasePanel } = useApprovalPanel();
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [requirementDialogOpen, setRequirementDialogOpen] = React.useState(false);
  const [requirementMessage, setRequirementMessage] = React.useState('');

  React.useEffect(() => {
    if (user && firestore) {
      getOrCreateUser(firestore, user.uid, user.email || '', user.displayName || '')
        .then(profile => setUserRole(profile?.role || null))
        .catch(() => setUserRole(null));
    }
  }, [user, firestore]);

  const loanRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'loans', loanId) : null),
    [firestore, loanId]
  );

  const { data: rawLoan, isLoading } = useDoc<Loan>(loanRef);

  const loan = React.useMemo(() => {
    if (!rawLoan) return null;
    const toDate = (ts: any) =>
      ts && ts.seconds
        ? new Timestamp(ts.seconds, ts.nanoseconds).toDate()
        : null;

    return {
      ...rawLoan,
      createdAt: toDate(rawLoan.createdAt) || new Date(),
      updatedAt: toDate(rawLoan.updatedAt) || new Date(),
      releasedAt: toDate(rawLoan.releasedAt) || undefined,
      loanNumber: rawLoan.loanNumber || 0,
    };
  }, [rawLoan]);

  React.useEffect(() => {
    if (showReleasePanel && loan?.status === 'approved') {
      setComputationDialogOpen(true);
    }
  }, [showReleasePanel, loan?.status]);

  React.useEffect(() => {
    if (!loan || !loanRef || loan.status !== 'pending') return;

    const updates: Partial<LoanWrite> = {};
    let needsUpdate = false;

    if (!loan.bookkeeperChecked) {
      updates.bookkeeperChecked = true;
      needsUpdate = true;
    }

    if (!loan.payrollChecked && loan.salary > 0) {
      updates.payrollChecked = true;
      needsUpdate = true;
    }

    if (needsUpdate) {
      updateDocumentNonBlocking(loanRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    }
  }, [loan, loanRef]);

  React.useEffect(() => {
    if (!loan || !firestore || loan.status !== 'released' || !loan.releasedAt) return;

    const regeneratePaymentSchedule = async () => {
      try {
        const paymentsRef = collection(firestore, 'loans', loanId, 'payments');
        const paymentsQuery = query(paymentsRef, orderBy('paymentNumber', 'asc'));
        const snapshot = await getDocs(paymentsQuery);

        if (snapshot.empty) return;

        const releasedAtDate = loan.releasedAt instanceof Date ? loan.releasedAt : (loan.releasedAt as any).toDate();
        const batch = writeBatch(firestore);

        snapshot.docs.forEach((paymentDoc, index) => {
          const dueDate = addMonths(releasedAtDate, index + 1);
          batch.update(paymentDoc.ref, {
            dueDate: Timestamp.fromDate(dueDate),
          });
        });

        await batch.commit();
      } catch (error) {
        console.error('Error regenerating payment schedule:', error);
      }
    };

    regeneratePaymentSchedule();
  }, [loan?.releasedAt, firestore, loanId, loan?.status]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [isDenyDialogOpen, setDenyDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isComputationDialogOpen, setComputationDialogOpen] =
    React.useState(false);
  const [denialRemarks, setDenialRemarks] = React.useState('');

  const handleUpdate = async (data: Partial<LoanWrite>) => {
    if (!loanRef) return;
    setIsSubmitting(true);
    try {
      await new Promise((resolve) => {
        updateDocumentNonBlocking(loanRef, {
          ...data,
          updatedAt: serverTimestamp(),
        });
        resolve(true);
      });

      toast({
        title: 'Update In Progress',
        description: 'The loan application is being updated.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: (error as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRelease = async () => {
    if (!firestore || !loan || !loanRef) return;
    setIsSubmitting(true);
    try {
      const releasedAtDate = new Date();
      const batch = writeBatch(firestore);

      batch.update(loanRef, {
        status: 'released',
        releasedAt: Timestamp.fromDate(releasedAtDate),
        updatedAt: serverTimestamp(),
      });

      const paymentSchedule = generatePaymentSchedule(loan, releasedAtDate);
      paymentSchedule.forEach((payment) => {
        const paymentRef = doc(collection(firestore, 'loans', loanId, 'payments'));
        batch.set(paymentRef, payment);
      });

      await batch.commit();

      toast({
        title: 'Loan Released',
        description: 'The funds have been released and the collection schedule is generated.',
      });

      setComputationDialogOpen(false);
    } catch (error) {
      console.error("Error releasing loan: ", error);
      toast({
        variant: 'destructive',
        title: 'Release Failed',
        description: (error as Error).message || "An unknown error occurred.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!denialRemarks) {
      toast({
        variant: 'destructive',
        title: 'Remarks Required',
        description: 'Please provide a reason for denial.',
      });
      return;
    }
    await handleUpdate({ status: 'denied', denialRemarks });
    setDenyDialogOpen(false);
    setDenialRemarks('');
  };

  const handleDelete = async () => {
    if (!loanRef) return;
    setIsSubmitting(true);
    try {
      deleteDocumentNonBlocking(loanRef);
      toast({
        title: 'Loan Deleted',
        description: 'The loan application has been successfully deleted.',
      });
      router.push('/');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: (error as Error).message,
      });
      setIsSubmitting(false);
    }
  };

  const handleApproveClick = () => {
    if (!loan?.bookkeeperChecked) {
      setRequirementMessage('Bookkeeper must verify the loan before approval.');
      setRequirementDialogOpen(true);
      return;
    }
    if (!loan?.payrollChecked) {
      setRequirementMessage('Payroll Checker must verify the salary before approval.');
      setRequirementDialogOpen(true);
      return;
    }
    handleUpdate({ status: 'approved' });
  };

  const handleDenyClick = () => {
    if (!loan?.payrollChecked) {
      setRequirementMessage('Payroll Checker must verify the salary before denial.');
      setRequirementDialogOpen(true);
      return;
    }
    setDenyDialogOpen(true);
  };

  const handleBackClick = () => {
    if ((showApprovalPanel || showSalaryInputPanel || showPastDuePanel || showPenaltyPanel || showReleasePanel) && onBack) {
      onBack();
    } else {
      router.push('/');
    }
  };

  const InfoItem = (
    {
      label,
      value,
      isLoading,
    }: {
      label: string;
      value: React.ReactNode;
      isLoading?: boolean;
    }
  ) => (
    <div className="flex justify-between items-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      {isLoading ? (
        <Skeleton className="h-5 w-24" />
      ) : (
        <div className="text-sm font-medium text-right">{value}</div>
      )}
    </div>
  );

  if (isLoading && !loan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" disabled>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <Skeleton className="h-7 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-7 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-7 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="text-center py-10">
        <p className="mb-4">
          This loan application could not be found. It might have been deleted.
        </p>
        <Button onClick={() => router.push('/')}>Go to Dashboard</Button>
      </div>
    );
  }

  const loanSerializable: LoanSerializable = {
    ...loan,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
    releasedAt: loan.releasedAt ? loan.releasedAt.toISOString() : undefined,
  };

  const isWorkflowDisabled = ['released', 'fully-paid', 'denied'].includes(loan.status);
  const isPayrollCheckerRole = userRole === 'payrollChecker';
  const isBookkeeperRole = userRole === 'bookkeeper';
  const isApproverRole = userRole === 'approver';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={handleBackClick}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {loan.applicantName}
          </h1>
          <p className="text-muted-foreground">
            Loan #{loan.loanNumber}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Current Status</p>
          <StatusBadge status={loan.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Column 1: Basic Information */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Core loan details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoItem label="Loan Type" value={loan.loanType} />
              <InfoItem label="Purpose" value={loan.purpose} />
              <InfoItem
                label="Amount"
                value={new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'PHP',
                }).format(loan.amount)}
              />
              <InfoItem
                label="Payment Term"
                value={`${loan.paymentTerm} month${loan.paymentTerm > 1 ? 's' : ''}`}
              />
              <InfoItem label="Created" value={format(loan.createdAt, 'PP')} />
              {loan.remarks && <InfoItem label="Remarks" value={loan.remarks} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Management</CardTitle>
              <CardDescription>Edit and manage loan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setSheetOpen(true)}
                disabled={loan.status === 'fully-paid' || isPayrollCheckerRole || isApproverRole || (isBookkeeperRole && loan.status !== 'pending')}
              >
                <FilePenLine className="h-4 w-4 mr-2" />
                Edit Loan
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isSubmitting || isPayrollCheckerRole || isApproverRole || (isBookkeeperRole && loan.status !== 'pending')}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Loan
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Workflow Progress */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Progress</CardTitle>
              <CardDescription>Current status: <StatusBadge status={loan.status} /></CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress Timeline */}
              <div className="space-y-4">
                <div className={`flex items-center gap-3 p-3 rounded-lg ${loan.status === 'pending' ? 'bg-blue-50 border border-blue-200' : 'bg-muted/50'
                  }`}>
                  <ClipboardCheck className={`h-5 w-5 ${['pending', 'approved', 'released', 'fully-paid'].includes(loan.status) ? 'text-green-500' : 'text-muted-foreground'
                    }`} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Created</p>
                    <p className="text-xs text-muted-foreground">{format(loan.createdAt, 'PP')}</p>
                  </div>
                  {['pending', 'approved', 'released', 'fully-paid'].includes(loan.status) && <Check className="h-4 w-4 text-green-500" />}
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${loan.status === 'pending' && (!loan.salary || loan.salary === 0) ? 'bg-yellow-50 border border-yellow-200' : 'bg-muted/50'
                  }`}>
                  <DollarSign className={`h-5 w-5 ${loan.payrollChecked ? 'text-green-500' : 'text-yellow-500'
                    }`} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Salary Input</p>
                    <p className="text-xs text-muted-foreground">
                      {loan.salary ? `₱${loan.salary.toLocaleString()}` : 'Pending input'}
                    </p>
                  </div>
                  {loan.payrollChecked && <Check className="h-4 w-4 text-green-500" />}
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${loan.status === 'pending' && loan.payrollChecked ? 'bg-purple-50 border border-purple-200' : 'bg-muted/50'
                  }`}>
                  <ThumbsUp className={`h-5 w-5 ${['approved', 'released', 'fully-paid'].includes(loan.status) ? 'text-green-500' :
                      loan.status === 'denied' ? 'text-red-500' : 'text-muted-foreground'
                    }`} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Approval</p>
                    <p className="text-xs text-muted-foreground">
                      {loan.status === 'approved' ? 'Approved' :
                        loan.status === 'denied' ? 'Denied' : 'Pending approval'}
                    </p>
                  </div>
                  {['approved', 'released', 'fully-paid'].includes(loan.status) && <Check className="h-4 w-4 text-green-500" />}
                  {loan.status === 'denied' && <X className="h-4 w-4 text-red-500" />}
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-lg ${loan.status === 'approved' ? 'bg-green-50 border border-green-200' : 'bg-muted/50'
                  }`}>
                  <Banknote className={`h-5 w-5 ${['released', 'fully-paid'].includes(loan.status) ? 'text-green-500' : 'text-muted-foreground'
                    }`} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Fund Release</p>
                    <p className="text-xs text-muted-foreground">
                      {loan.releasedAt ? format(loan.releasedAt, 'PP') : 'Pending release'}
                    </p>
                  </div>
                  {['released', 'fully-paid'].includes(loan.status) && <Check className="h-4 w-4 text-green-500" />}
                </div>
              </div>

              {loan.status === 'denied' && loan.denialRemarks && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="font-medium text-sm text-red-800">Denial Reason</p>
                  <p className="text-sm text-red-700">{loan.denialRemarks}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Action Card */}
          <Card>
            <CardHeader>
              <CardTitle>Current Action</CardTitle>
              <CardDescription>What needs to be done next</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Salary Input (Payroll Checker) */}
              {loan.status === 'pending' && (!loan.salary || loan.salary === 0) && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Salary Input Required</p>
                  <div className="relative flex items-center">
                    <span className="absolute left-2 text-muted-foreground">₱</span>
                    <Input
                      type="number"
                      key={loan.id}
                      defaultValue={loan.salary || 0}
                      placeholder="Enter salary"
                      onBlur={(e) => {
                        const salaryValue = Number(e.target.value) || 0;
                        if (salaryValue !== loan.salary) {
                          handleUpdate({
                            salary: salaryValue,
                            payrollChecked: salaryValue > 0
                          });
                        }
                      }}
                      className="pl-6 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      disabled={isSubmitting || !isPayrollCheckerRole}
                    />
                  </div>
                  {!isPayrollCheckerRole && (
                    <p className="text-xs text-muted-foreground">Only payroll checker can input salary</p>
                  )}
                </div>
              )}

              {/* Approval Actions (Approver) */}
              {loan.status === 'pending' && loan.payrollChecked && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Approval Required</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleApproveClick}
                      disabled={isSubmitting || !isApproverRole}
                      className="flex-1"
                    >
                      <ThumbsUp className="mr-2 h-4 w-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDenyClick}
                      disabled={isSubmitting || !isApproverRole}
                      className="flex-1"
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" /> Deny
                    </Button>
                  </div>
                  {!isApproverRole && (
                    <p className="text-xs text-muted-foreground">Only approver can approve/deny loans</p>
                  )}
                </div>
              )}

              {/* Release Fund (Bookkeeper) */}
              {loan.status === 'approved' && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Ready for Release</p>
                  <Button
                    className="w-full"
                    onClick={() => setComputationDialogOpen(true)}
                    disabled={!isBookkeeperRole}
                  >
                    <Calculator className="mr-2 h-4 w-4" />
                    View Computation & Release
                  </Button>
                  {!isBookkeeperRole && (
                    <p className="text-xs text-muted-foreground">Only bookkeeper can release funds</p>
                  )}
                </div>
              )}

              {/* Collection Phase */}
              {['released', 'fully-paid'].includes(loan.status) && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Collection Phase</p>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setComputationDialogOpen(true)}
                  >
                    <Calculator className="mr-2 h-4 w-4" />
                    View Computation
                  </Button>
                </div>
              )}

              {/* Completed/Denied */}
              {loan.status === 'fully-paid' && (
                <div className="text-center py-4">
                  <Check className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-700">Loan Fully Paid</p>
                </div>
              )}

              {loan.status === 'denied' && (
                <div className="text-center py-4">
                  <X className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-red-700">Loan Denied</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Additional Info & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Verification Status</CardTitle>
              <CardDescription>Required checks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Bookkeeper Verified</Label>
                <div className="text-sm">
                  {loan.bookkeeperChecked ?
                    <Check className="h-4 w-4 text-green-500" /> :
                    <X className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Payroll Verified</Label>
                <div className="text-sm">
                  {loan.payrollChecked ?
                    <Check className="h-4 w-4 text-green-500" /> :
                    <X className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loan History</CardTitle>
              <CardDescription>Important dates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoItem label="Created" value={format(loan.createdAt, 'PPpp')} />
              <InfoItem label="Last Updated" value={format(loan.updatedAt, 'PPpp')} />
              {loan.releasedAt && (
                <InfoItem label="Released" value={format(loan.releasedAt, 'PPpp')} />
              )}
            </CardContent>
          </Card>

          <ExistingLoansCheck
            applicantName={loan.applicantName}
            currentLoanId={loan.id}
          />
        </div>
      </div>

      {/* Collection Schedule - Full Width */}
      {(loan.status === 'released' || loan.status === 'fully-paid') && loan.releasedAt && (
        <div className="mt-6">
          <CollectionSchedule loan={loan} userRole={userRole} />
        </div>
      )}

      <LoanFormSheet
        open={isSheetOpen}
        onOpenChange={setSheetOpen}
        loan={loanSerializable}
      />

      <AlertDialog open={requirementDialogOpen} onOpenChange={setRequirementDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot Proceed</AlertDialogTitle>
            <AlertDialogDescription>
              {requirementMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDenyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny Loan Application</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide remarks for denying this loan. This will be visible
              to the team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="denial-remarks" className="sr-only">
              Denial Remarks
            </Label>
            <Input
              id="denial-remarks"
              placeholder="e.g., Insufficient salary"
              value={denialRemarks}
              onChange={(e) => setDenialRemarks(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeny}
              disabled={!denialRemarks || isSubmitting}
            >
              Confirm Denial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              loan application and remove its data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, delete loan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {loan && (
        <LoanComputationDialog
          open={isComputationDialogOpen}
          onOpenChange={setComputationDialogOpen}
          loan={loan}
          onRelease={handleRelease}
          isSubmitting={isSubmitting}
          userRole={userRole}
        />
      )}
    </div>
  );
}