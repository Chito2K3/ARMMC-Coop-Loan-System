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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { doc, serverTimestamp, Timestamp } from 'firebase/firestore';

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
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { toast } from '@/hooks/use-toast';
import type { Loan, LoanWrite, LoanSerializable } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { LoanFormSheet } from './loan-form-sheet';
import { ExistingLoansCheck } from './existing-loans-check';
import { LoanComputationDialog } from './loan-computation-dialog';

export function LoanDetailView({ loanId }: { loanId: string }) {
  const router = useRouter();
  const firestore = useFirestore();

  const loanRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'loans', loanId) : null),
    [firestore, loanId]
  );

  const { data: rawLoan, isLoading } = useDoc<Loan>(loanRef);

  const loan = React.useMemo(() => {
    if (!rawLoan) return null;
    const createdAtDate =
      rawLoan.createdAt && (rawLoan.createdAt as any).seconds
        ? new Timestamp(
            (rawLoan.createdAt as any).seconds,
            (rawLoan.createdAt as any).nanoseconds
          ).toDate()
        : new Date();
    const updatedAtDate =
      rawLoan.updatedAt && (rawLoan.updatedAt as any).seconds
        ? new Timestamp(
            (rawLoan.updatedAt as any).seconds,
            (rawLoan.updatedAt as any).nanoseconds
          ).toDate()
        : new Date();

    return {
      ...rawLoan,
      createdAt: createdAtDate,
      updatedAt: updatedAtDate,
    };
  }, [rawLoan]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [isDenyDialogOpen, setDenyDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [isComputationDialogOpen, setComputationDialogOpen] = React.useState(false);
  const [denialRemarks, setDenialRemarks] = React.useState('');

  const handleUpdate = async (data: Partial<LoanWrite>) => {
    if (!loanRef) return;
    setIsSubmitting(true);
    try {
      updateDocumentNonBlocking(loanRef, {
        ...data,
        updatedAt: serverTimestamp(),
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

  const InfoItem = ({
    label,
    value,
    isLoading,
  }: {
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
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
          </div>
          <div className="space-y-6">
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
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Loan #{loan.id.slice(-6)}
          </h1>
          <p className="text-muted-foreground">
            Applicant: {loan.applicantName}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Loan Details</CardTitle>
              <CardDescription>
                Core information about the application.
              </CardDescription>
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
                label="Salary"
                value={
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      defaultValue={loan.salary}
                      onBlur={(e) =>
                        handleUpdate({ salary: Number(e.target.value) })
                      }
                      className="h-8 text-right w-32"
                      disabled={isSubmitting}
                    />
                  </div>
                }
              />
              <InfoItem
                label="Payment Term"
                value={`${loan.paymentTerm} month${
                  loan.paymentTerm > 1 ? 's' : ''
                }`}
              />
              <InfoItem
                label="Status"
                value={<StatusBadge status={loan.status} />}
              />
              <InfoItem label="Created" value={format(loan.createdAt, 'PP')} />
              <InfoItem
                label="Last Updated"
                value={format(loan.updatedAt, 'PPpp')}
              />
              {loan.remarks && <InfoItem label="Remarks" value={loan.remarks} />}
              {loan.status === 'denied' && loan.denialRemarks && (
                <InfoItem
                  label="Denial Remarks"
                  value={
                    <span className="text-destructive font-medium">
                      {loan.denialRemarks}
                    </span>
                  }
                />
              )}
            </CardContent>
            <CardFooter className="flex justify-between items-center border-t pt-6">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSheetOpen(true)}
              >
                <FilePenLine className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isSubmitting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Loan
                </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Approval Workflow</CardTitle>
              <CardDescription>Manage the loan's journey.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <ExistingLoansCheck
                applicantName={loan.applicantName}
                currentLoanId={loan.id}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleUpdate({ status: 'approved' })}
                  disabled={isSubmitting || loan.status === 'approved'}
                >
                  <ThumbsUp className="mr-2 h-4 w-4" /> Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setDenyDialogOpen(true)}
                  disabled={isSubmitting || loan.status === 'denied'}
                >
                  <ThumbsDown className="mr-2 h-4 w-4" /> Deny
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleUpdate({ status: 'released' })}
                  disabled={isSubmitting || loan.status !== 'approved'}
                >
                  Mark as Released
                </Button>
              </div>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium">Checklists</h4>
                <div className="flex items-center justify-between">
                  <Label htmlFor="bookkeeperChecked">Bookkeeper Checked</Label>
                  <Button
                    variant={loan.bookkeeperChecked ? 'default' : 'outline'}
                    size="icon"
                    onClick={() =>
                      handleUpdate({ bookkeeperChecked: !loan.bookkeeperChecked })
                    }
                    disabled={isSubmitting}
                  >
                    {loan.bookkeeperChecked ? <Check /> : <X />}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="payrollChecked">Payroll Checked</Label>
                  <Button
                    variant={loan.payrollChecked ? 'default' : 'outline'}
                    size="icon"
                    onClick={() =>
                      handleUpdate({ payrollChecked: !loan.payrollChecked })
                    }
                    disabled={isSubmitting}
                  >
                    {loan.payrollChecked ? <Check /> : <X />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {loan.status === 'approved' && (
            <Card>
              <CardHeader>
                <CardTitle>Loan Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => setComputationDialogOpen(true)}>
                  <Calculator className="mr-2 h-4 w-4" />
                  Compute Loan
                </Button>
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      <LoanFormSheet
        open={isSheetOpen}
        onOpenChange={setSheetOpen}
        loan={loanSerializable}
      />
      <AlertDialog open={isDenyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny Loan Application</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide remarks for denying this loan. This will be
              visible to the team.
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
        />
      )}
    </div>
  );
}
