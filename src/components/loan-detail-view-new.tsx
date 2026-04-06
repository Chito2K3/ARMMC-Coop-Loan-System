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
  Printer,
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
  getDoc,
  setDoc,
  where,
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
import { getUser, type UserProfile } from '@/firebase/user-service';
import { toast } from '@/hooks/use-toast';
import type { Loan, LoanWrite, LoanSerializable, PaymentWrite } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { LoanFormSheet } from './loan-form-sheet';
import { ExistingLoansCheck } from './existing-loans-check';
import { LoanComputationDialog } from './loan-computation-dialog';
import { CollectionSchedule } from './collection-schedule';
import { useApprovalPanel } from './approval-context';
import { PrintableLoanForm } from './printable-loan-form';

const generatePaymentSchedule = (loan: Loan, releasedAt: Date): PaymentWrite[] => {
  if (!releasedAt || loan.paymentTerm <= 0) return [];

  const principal = loan.amount;
  const term = loan.paymentTerm;
  const interestRate = 0.015; // 1.5% diminishing

  const approximateMonthlyPrincipalPayment = principal / term;
  let beginningBalance = principal;
  let totalPrincipalPaid = 0;

  const paymentSchedule: PaymentWrite[] = [];

  for (let i = 0; i < term; i++) {
    const month = i + 1;
    const interest = beginningBalance * interestRate;

    let principalPayment = 0;
    let totalAmount = 0;

    if (month === term) {
      principalPayment = principal - totalPrincipalPaid;
      totalAmount = principalPayment + interest;
    } else {
      const exactTotalPayment = approximateMonthlyPrincipalPayment + interest;
      totalAmount = Math.round(exactTotalPayment);
      principalPayment = totalAmount - interest;
    }

    const dueDate = addMonths(releasedAt, month);

    // Month 1 is deducted from purely net proceeds if term > 1, so it is "paid" upfront implicitly by the coop
    const isFirstMonthDeducted = month === 1 && term > 1;

    paymentSchedule.push({
      loanId: loan.id,
      paymentNumber: month,
      dueDate: Timestamp.fromDate(dueDate),
      amount: totalAmount,
      status: isFirstMonthDeducted ? 'paid' : 'pending',
      penalty: 0,
      penaltyWaived: false,
      ...(isFirstMonthDeducted && {
        actualAmountPaid: totalAmount,
        paymentDate: Timestamp.fromDate(releasedAt),
      })
    });

    beginningBalance -= principalPayment;
    totalPrincipalPaid += principalPayment;
  }

  // Handle single payment logic where interest is fully deducted
  if (term === 1 && paymentSchedule.length > 0) {
    paymentSchedule[0].amount -= paymentSchedule[0].amount * (interestRate / (principal + interestRate)); // simplify, single payment loans remove upfront interest
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
  const { showApprovalPanel, showSalaryInputPanel, showPastDuePanel, showReleasePanel, setSelectedLoanId } = useApprovalPanel();
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [requirementDialogOpen, setRequirementDialogOpen] = React.useState(false);
  const [requirementMessage, setRequirementMessage] = React.useState('');

  React.useEffect(() => {
    if (user && firestore) {
      getUser(firestore, user.uid, user.email || '', user.displayName || '')
        .then((profile: UserProfile | null) => setUserRole(profile?.role || null))
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
      final_surcharge_date: toDate(rawLoan.final_surcharge_date) || undefined,
      loanNumber: rawLoan.loanNumber || 0,
    };
  }, [rawLoan]);

  React.useEffect(() => {
    if (showReleasePanel && loan?.status === 'approved') {
      setComputationDialogOpen(true);
    }
  }, [showReleasePanel, loan]);

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
  }, [loan?.releasedAt, firestore, loanId, loan?.status, loan]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [isDenyDialogOpen, setDenyDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isComputationDialogOpen, setComputationDialogOpen] =
    React.useState(false);
  const [denialRemarks, setDenialRemarks] = React.useState('');
  const printRef = React.useRef<HTMLDivElement>(null!);

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
      // Ensure a users/{uid} doc exists so security rules that look up by UID succeed.
      try {
        if (user) {
          const userRef = doc(firestore, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            if (user.email) {
              const usersRef = collection(firestore, 'users');
              const emailQ = query(usersRef, where('email', '==', user.email));
              const emailSnap = await getDocs(emailQ);
              if (!emailSnap.empty) {
                const data = emailSnap.docs[0].data();
                await setDoc(userRef, {
                  email: data.email || user.email,
                  name: data.name || user.displayName || '',
                  role: data.role || 'user',
                  createdAt: data.createdAt || serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } else {
                await setDoc(userRef, {
                  email: user.email || '',
                  name: user.displayName || '',
                  role: 'user',
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
            } else {
              await setDoc(userRef, {
                email: '',
                name: user.displayName || '',
                role: 'user',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          }
        }
      } catch (err) {
        console.error('Error ensuring users/{uid} doc before release:', err);
      }

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
    } catch (error: any) {
      const serialize = (err: any) => {
        try {
          return JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
        } catch (_) {
          return String(err);
        }
      };
      console.error('Error releasing loan:', error, serialize(error));
      toast({
        variant: 'destructive',
        title: 'Release Failed',
        description: error?.code || error?.message || String(error) || 'An unknown error occurred.',
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
      await deleteDocumentNonBlocking(loanRef);
      toast({
        title: 'Loan Deleted',
        description: 'The loan application has been successfully deleted.',
      });
      router.push('/');
    } catch (error) {
      console.error('Error deleting loan:', error);
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: (error as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = async () => {
    if (!printRef.current || !loan) return;
    setIsPrinting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Loan-Application-${loan.applicantName}-#${loan.loanNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ variant: 'destructive', title: 'Print Failed', description: 'Could not generate PDF. Please try again.' });
    } finally {
      setIsPrinting(false);
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
    if (onBack) {
      onBack();
    } else {
      router.push('/');
      setSelectedLoanId(null);
    }
  };

  const InfoItem = ({ label, value, isLoading }: {
    label: string;
    value: React.ReactNode;
    isLoading?: boolean;
  }) => (
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
    final_surcharge_date: loan.final_surcharge_date ? (loan.final_surcharge_date as Date).toISOString() : undefined,
  };

  const isWorkflowDisabled = ['released', 'fully-paid', 'denied'].includes(loan.status);
  const isPayrollCheckerRole = userRole === 'payrollChecker';
  const isBookkeeperRole = userRole === 'bookkeeper';
  const isApproverRole = userRole === 'approver';

  const isReleasedOrPaid = loan.status === 'released' || loan.status === 'fully-paid';

  const basicInfoCard = (
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
  );

  const managementCard = (
    <Card>
      <CardHeader>
        <CardTitle>Management</CardTitle>
        <CardDescription>Edit and manage loan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          size="sm"
          variant="default"
          className="w-full"
          onClick={() => setSheetOpen(true)}
          disabled={isSubmitting || isPayrollCheckerRole || isApproverRole || (isBookkeeperRole && loan.status !== 'pending')}
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
  );

  const workflowCard = (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Progress</CardTitle>
        <CardDescription>Current status: <StatusBadge status={loan.status} /></CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className={`flex items-center gap-3 p-3 rounded-lg ${loan.status === 'pending' ? 'bg-blue-50 border border-blue-200' : 'bg-muted/50'}`}>
            <ClipboardCheck className={`h-5 w-5 ${['pending', 'approved', 'released', 'fully-paid'].includes(loan.status) ? 'text-green-500' : 'text-muted-foreground'}`} />
            <div className="flex-1">
              <p className="font-medium text-sm">Created</p>
              <p className="text-xs text-muted-foreground">{format(loan.createdAt, 'PP')}</p>
            </div>
            {['pending', 'approved', 'released', 'fully-paid'].includes(loan.status) && <Check className="h-4 w-4 text-green-500" />}
          </div>

          <div className={`flex items-center gap-3 p-3 rounded-lg ${loan.status === 'pending' && (!loan.salary || loan.salary === 0) ? 'bg-yellow-50 border border-yellow-200' : 'bg-muted/50'}`}>
            <DollarSign className={`h-5 w-5 ${loan.payrollChecked ? 'text-green-500' : 'text-yellow-500'}`} />
            <div className="flex-1">
              <p className="font-medium text-sm">Salary Input</p>
              <p className="text-xs text-muted-foreground">{loan.salary ? `₱${loan.salary.toLocaleString()}` : 'Pending input'}</p>
            </div>
            {loan.payrollChecked && <Check className="h-4 w-4 text-green-500" />}
          </div>

          <div className={`flex items-center gap-3 p-3 rounded-lg ${loan.status === 'pending' && loan.payrollChecked ? 'bg-purple-50 border border-purple-200' : 'bg-muted/50'}`}>
            <ThumbsUp className={`h-5 w-5 ${['approved', 'released', 'fully-paid'].includes(loan.status) ? 'text-green-500' : loan.status === 'denied' ? 'text-red-500' : 'text-muted-foreground'}`} />
            <div className="flex-1">
              <p className="font-medium text-sm">Approval</p>
              <p className="text-xs text-muted-foreground">{loan.status === 'approved' ? 'Approved' : loan.status === 'denied' ? 'Denied' : 'Pending approval'}</p>
            </div>
            {['approved', 'released', 'fully-paid'].includes(loan.status) && <Check className="h-4 w-4 text-green-500" />}
            {loan.status === 'denied' && <X className="h-4 w-4 text-red-500" />}
          </div>

          <div className={`flex items-center gap-3 p-3 rounded-lg ${loan.status === 'approved' ? 'bg-green-50 border border-green-200' : 'bg-muted/50'}`}>
            <Banknote className={`h-5 w-5 ${['released', 'fully-paid'].includes(loan.status) ? 'text-green-500' : 'text-muted-foreground'}`} />
            <div className="flex-1">
              <p className="font-medium text-sm">Fund Release</p>
              <p className="text-xs text-muted-foreground">{loan.releasedAt ? format(loan.releasedAt, 'PP') : 'Pending release'}</p>
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
  );

  const currentActionCard = (
    <Card>
      <CardHeader>
        <CardTitle>Current Action</CardTitle>
        <CardDescription>What needs to be done next</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
  );

  const verificationCard = (
    <Card>
      <CardHeader>
        <CardTitle>Verification Status</CardTitle>
        <CardDescription>Required checks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Bookkeeper Verified</Label>
          <div className="text-sm">
            {loan.bookkeeperChecked ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label>Payroll Verified</Label>
          <div className="text-sm">
            {loan.payrollChecked ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const loanHistoryCard = (
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
  );

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
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center gap-2 border-blue-300 text-blue-600 hover:bg-blue-50"
          >
            <Printer className="h-4 w-4" />
            {isPrinting ? 'Generating...' : 'Print'}
          </Button>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Current Status</p>
            <StatusBadge status={loan.status} />
          </div>
        </div>
      </div>

      {isReleasedOrPaid && loan.releasedAt && (
        <div className="mb-6">
          <CollectionSchedule loan={loan} userRole={userRole} />
        </div>
      )}

      {(() => {
        const loanActionsCard = (
          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle>Loan Actions</CardTitle>
              <CardDescription>View generalized computation</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col justify-end">
              <Button
                className="w-full font-bold shadow-md h-12"
                onClick={() => setComputationDialogOpen(true)}
              >
                <Calculator className="mr-2 h-5 w-5" />
                View Original Computation
              </Button>
            </CardContent>
          </Card>
        );

        return isReleasedOrPaid ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {basicInfoCard}
            {managementCard}
          </div>
          <div className="space-y-6">
            {loanHistoryCard}
            {loanActionsCard}
            <ExistingLoansCheck applicantName={loan.applicantName} currentLoanId={loan.id} />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            {basicInfoCard}
            {managementCard}
            {loanActionsCard}
          </div>
          <div className="space-y-6">
            {workflowCard}
            {currentActionCard}
          </div>
          <div className="space-y-6">
            {verificationCard}
            {loanHistoryCard}
            <ExistingLoansCheck applicantName={loan.applicantName} currentLoanId={loan.id} />
          </div>
        </div>
        );
      })()}

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

      {/* Hidden printable form rendered off-screen for PDF capture */}
      {loan && <PrintableLoanForm loan={loan} formRef={printRef} />}
    </div>
  );
}