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
import { Calendar as CalendarIcon, ChevronDown, Pencil } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { getPenaltySettings } from '@/firebase/penalty-service';
import type { Loan, Payment } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

interface CollectionScheduleProps {
  loan: Loan;
  userRole?: string | null;
}

const formatCurrency = (value: number) => {
  if (isNaN(value) || value === 0) return '₱0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PHP',
  }).format(value);
};

export function CollectionSchedule({ loan, userRole }: CollectionScheduleProps) {
  const firestore = useFirestore();
  const [penaltyAmount, setPenaltyAmount] = React.useState(500);
  const [gracePeriodDays, setGracePeriodDays] = React.useState(3);
  const [editingPaymentId, setEditingPaymentId] = React.useState<string | null>(null);
  const [editAmount, setEditAmount] = React.useState<number | ''>('');
  const [isAuditDialogOpen, setIsAuditDialogOpen] = React.useState(false);
  const [auditPaymentAmount, setAuditPaymentAmount] = React.useState<number | ''>('');

  React.useEffect(() => {
    const loadSettings = async () => {
      if (!firestore) return;
      try {
        const settings = await getPenaltySettings(firestore);
        setPenaltyAmount(settings.penaltyAmount);
        setGracePeriodDays(settings.gracePeriodDays);
      } catch (error) {
        console.error('Error loading penalty settings:', error);
      }
    };
    loadSettings();
  }, [firestore]);

  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'loans', loan.id, 'payments'),
      orderBy('paymentNumber', 'asc')
    );
  }, [firestore, loan.id]);

  const { data: rawPayments, isLoading, error: paymentsError } = useCollection<Payment>(paymentsQuery);

  const payments = React.useMemo(() => {
    if (!rawPayments) return [];
    return rawPayments.map((p) => ({
      ...p,
      dueDate: (p.dueDate as Timestamp).toDate(),
      paymentDate: p.paymentDate ? (p.paymentDate as Timestamp).toDate() : undefined,
    }));
  }, [rawPayments]);

  const { totalShortfall, surchargeAmount, isSurchargePending } = React.useMemo(() => {
    let shortfall = 0;
    payments.forEach(p => {
      if (p.status === 'paid' && p.actualAmountPaid !== undefined) {
        shortfall += (p.amount - p.actualAmountPaid);
      }
    });
    
    // Total shortfall including historical bucket, fixing float math errors
    const effectiveShortfall = Math.round(Math.max(loan.historical_shortfall_bucket || 0, shortfall) * 100) / 100;
    // Double 2% penalty -> 4%
    let surcharge = effectiveShortfall * 0.04;
    
    // Prevent zero-value ghost surcharges due to 0.00 rendering
    if (surcharge < 0.01) {
      surcharge = 0;
    }
    
    // Check if surcharge is paid
    const isPending = effectiveShortfall > 0 && surcharge > 0 && (loan.final_surcharge_paid || 0) < surcharge - 0.01;
    
    return { totalShortfall: effectiveShortfall, surchargeAmount: surcharge, isSurchargePending: isPending };
  }, [payments, loan.historical_shortfall_bucket, loan.final_surcharge_paid]);

  const handleSettleSurcharge = async () => {
    if (!firestore) return;
    const amount = Number(auditPaymentAmount);
    if (amount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter a valid amount.', variant: 'destructive' });
      return;
    }
    
    // Check if what they paid plus past payments satisfies the surcharge
    const totalPaidNow = (loan.final_surcharge_paid || 0) + amount;

    try {
      const loanRef = doc(firestore, 'loans', loan.id);
      
      await updateDocumentNonBlocking(loanRef, {
        final_surcharge_paid: totalPaidNow,
        final_surcharge_date: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      toast({
        title: 'Surcharge Payment Recorded',
        description: 'The audit payment has been applied.',
      });

      setIsAuditDialogOpen(false);
      setAuditPaymentAmount('');
      
      // Check if all payments are paid
      const allPaid = payments.every(p => p.status === 'paid');
      if (allPaid && totalPaidNow >= surchargeAmount - 0.01) {
        await updateDocumentNonBlocking(loanRef, { status: 'fully-paid' });
        toast({
          title: 'Loan Fully Paid!',
          description: 'Congratulations! This loan has been fully paid.',
          className: 'bg-green-100 text-green-800 border-green-200'
        });
      }
    } catch (error) {
      console.error('Error settling surcharge:', error);
      toast({
         title: 'Update Failed',
         description: 'Failed to settle surcharge.',
         variant: 'destructive',
      });
    }
  };

  const handleDateChange = async (paymentId: string, date: Date | undefined) => {
    if (!firestore || !date) return;

    try {
      const paymentRef = doc(firestore, 'loans', loan.id, 'payments', paymentId);
      await updateDocumentNonBlocking(paymentRef, {
        paymentDate: Timestamp.fromDate(date),
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Payment Date Updated',
        description: 'Please enter the actual amount paid to mark as complete.',
      });
    } catch (error) {
      console.error('Error updating payment date:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update payment date. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleActualAmountChange = async (paymentId: string, actualAmount: number) => {
    if (!firestore) return;

    try {
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) return;

      // Only mark as paid if we have an actual amount and a payment date
      if (actualAmount <= 0 || !payment.paymentDate) {
        toast({
          title: 'Invalid Entry',
          description: 'Please enter a payment amount and select a payment date.',
          variant: 'destructive',
        });
        return;
      }

      const paymentRef = doc(firestore, 'loans', loan.id, 'payments', paymentId);
      await updateDocumentNonBlocking(paymentRef, {
        actualAmountPaid: actualAmount,
        status: 'paid',
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Actual Amount Recorded',
        description: 'Payment has been marked as complete.',
      });

      // Calculate shortfall to prevent marking as fully-paid prematurely
      let currentShortfall = 0;
      payments.forEach(p => {
        if (p.id === paymentId) {
          if (typeof actualAmount === 'number') {
            currentShortfall += (p.amount - actualAmount);
          }
        } else if (p.status === 'paid' && p.actualAmountPaid !== undefined) {
          currentShortfall += (p.amount - p.actualAmountPaid);
        }
      });
      
      const effectiveShortfall = Math.max(loan.historical_shortfall_bucket || 0, currentShortfall);
      const surcharge = effectiveShortfall * 0.04;
      const isPending = effectiveShortfall > 0 && (loan.final_surcharge_paid || 0) < surcharge;

      // Check if all payments are now marked as paid
      const allPaid = payments.every(p => {
        if (p.id === paymentId) return true; // Current payment is now paid
        return p.status === 'paid';
      });

      if (allPaid && !isPending && effectiveShortfall <= 0) {
        const loanRef = doc(firestore, 'loans', loan.id);
        await updateDocumentNonBlocking(loanRef, { status: 'fully-paid' });
        toast({
          title: 'Loan Fully Paid!',
          description: 'Congratulations! This loan has been fully paid.',
          className: 'bg-green-100 text-green-800 border-green-200'
        });
      } else if (allPaid && (isPending || effectiveShortfall > 0)) {
        toast({
          title: 'Payments Complete, Audit Pending',
          description: 'All monthly schedules are paid, but a shortfall/surcharge must be settled.',
          className: 'bg-orange-100 text-orange-800 border-orange-200'
        });
      }
    } catch (error) {
      console.error('Error recording actual amount:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to record payment amount. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEditAmountSave = async () => {
    const amount = Number(editAmount);
    if (!editingPaymentId || amount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount.',
        variant: 'destructive',
      });
      return;
    }

    const payment = payments.find(p => p.id === editingPaymentId);
    if (!payment || !payment.paymentDate) {
      toast({
        title: 'Invalid Entry',
        description: 'Please select a payment date first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const paymentRef = doc(firestore, 'loans', loan.id, 'payments', editingPaymentId);
      await updateDocumentNonBlocking(paymentRef, {
        actualAmountPaid: amount,
        status: 'paid',
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Amount Updated',
        description: 'Actual paid amount has been recorded.',
      });

      setEditingPaymentId(null);
      setEditAmount('');

      // Calculate shortfall to prevent marking as fully-paid prematurely
      let currentShortfall = 0;
      payments.forEach(p => {
        if (p.id === editingPaymentId) {
          if (typeof amount === 'number') {
            currentShortfall += (p.amount - amount);
          }
        } else if (p.status === 'paid' && p.actualAmountPaid !== undefined) {
          currentShortfall += (p.amount - p.actualAmountPaid);
        }
      });
      
      const effectiveShortfall = Math.max(loan.historical_shortfall_bucket || 0, currentShortfall);
      const surcharge = effectiveShortfall * 0.04;
      const isPending = effectiveShortfall > 0 && (loan.final_surcharge_paid || 0) < surcharge;

      // Check if all payments are now marked as paid
      const allPaid = payments.every(p => {
        if (p.id === editingPaymentId) return true;
        return p.status === 'paid';
      });

      if (allPaid && !isPending && effectiveShortfall <= 0) {
        const loanRef = doc(firestore, 'loans', loan.id);
        await updateDocumentNonBlocking(loanRef, { status: 'fully-paid' });
        toast({
          title: 'Loan Fully Paid!',
          description: 'Congratulations! This loan has been fully paid.',
          className: 'bg-green-100 text-green-800 border-green-200'
        });
      } else if (allPaid && (isPending || effectiveShortfall > 0)) {
        toast({
          title: 'Payments Complete, Audit Pending',
          description: 'All monthly schedules are paid, but a shortfall/surcharge must be settled.',
          className: 'bg-orange-100 text-orange-800 border-orange-200'
        });
      }
    } catch (error) {
      console.error('Error updating amount:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update amount. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleWaivePenalty = async (paymentId: string) => {
    if (!firestore) return;
    try {
      const paymentRef = doc(firestore, 'loans', loan.id, 'payments', paymentId);
      await updateDocumentNonBlocking(paymentRef, {
        penaltyWaived: true,
        updatedAt: serverTimestamp(),
      });

      // Touch loan to trigger sidebar refresh
      const loanRef = doc(firestore, 'loans', loan.id);
      await updateDocumentNonBlocking(loanRef, { updatedAt: serverTimestamp() });

      toast({
        title: 'Penalty Waived',
        description: 'The penalty for this payment has been waived.',
      });
    } catch (error) {
      console.error('Error waiving penalty:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to waive penalty. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDenyPenalty = async (paymentId: string, paymentNumber: number) => {
    if (!firestore) return;
    const currentPayment = payments.find(p => p.id === paymentId);
    if (!currentPayment) return;

    try {
      const penalty = calculatePenalty(currentPayment);

      const currentPaymentRef = doc(firestore, 'loans', loan.id, 'payments', paymentId);
      await updateDocumentNonBlocking(currentPaymentRef, {
        penaltyDenied: true,
        updatedAt: serverTimestamp(),
      });

      const nextPayment = payments.find(p => p.paymentNumber === paymentNumber + 1);
      if (nextPayment) {
        const nextPaymentRef = doc(firestore, 'loans', loan.id, 'payments', nextPayment.id);
        await updateDocumentNonBlocking(nextPaymentRef, {
          amount: nextPayment.amount + penalty,
          updatedAt: serverTimestamp(),
        });
      }

      toast({
        title: 'Penalty Deferred',
        description: 'The penalty has been carried over to the next payment.',
      });

      // Touch loan to trigger sidebar refresh
      const loanRef = doc(firestore, 'loans', loan.id);
      await updateDocumentNonBlocking(loanRef, { updatedAt: serverTimestamp() });
    } catch (error) {
      console.error('Error deferring penalty:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to defer penalty. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getPaymentStatus = (payment: (typeof payments)[0]) => {
    const dueDate = payment.dueDate;
    const paymentDate = payment.paymentDate;

    if (paymentDate) {
      const isLate = differenceInDays(paymentDate, dueDate) > gracePeriodDays;
      return isLate ? (
        <Badge variant="destructive">Paid (Late)</Badge>
      ) : (
        <Badge className="bg-green-600 hover:bg-green-700">Paid</Badge>
      );
    }

    return <Badge variant="outline">Pending</Badge>;
  };

  const calculatePenalty = (payment: (typeof payments)[0]) => {
    if (payment.penaltyWaived) return 0;

    if (payment.status === 'paid' && payment.actualAmountPaid !== undefined && payment.actualAmountPaid < payment.amount) {
      const shortfall = payment.amount - payment.actualAmountPaid;
      return shortfall * 0.02; // 2% per month equivalent
    }

    return 0;
  };

  const getPaymentComparison = (payment: (typeof payments)[0]) => {
    if (!payment.actualAmountPaid) return null;

    const difference = Math.round((payment.actualAmountPaid - payment.amount) * 100) / 100;

    if (Math.abs(difference) < 0.01) {
      return { label: '✓ Full', color: 'text-green-600' };
    } else if (difference < 0) {
      return { label: `⚠️ Short ₱${Math.abs(difference).toLocaleString()}`, color: 'text-orange-600' };
    } else {
      return { label: `ℹ️ Change ₱${difference.toLocaleString()}`, color: 'text-blue-600' };
    }
  };

  return (
    <Card className="border-2 shadow-md border-primary/20">
      <CardHeader className="pb-6">
        <CardTitle className="text-2xl text-primary font-bold">Collection Schedule</CardTitle>
        <CardDescription className="text-base">
          Manage monthly payments, penalties, and payment dates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] w-full rounded-md border">
          <Table className="text-base">
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow className="text-base">
                <TableHead className="w-[50px] font-semibold">#</TableHead>
                <TableHead className="font-semibold">Due Date</TableHead>
                <TableHead className="font-semibold">Payment Date</TableHead>
                <TableHead className="text-right font-semibold">Amount</TableHead>
                <TableHead className="text-right font-semibold">Actual Paid</TableHead>
                <TableHead className="text-right font-semibold">Penalty</TableHead>
                <TableHead className="text-center font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsError && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-destructive">
                    Failed to load payment schedule.
                  </TableCell>
                </TableRow>
              )}
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
                const comparison = getPaymentComparison(payment);
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {payment.paymentNumber}
                    </TableCell>
                    <TableCell>
                      {payment.dueDate ? format(payment.dueDate, 'MMM d, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={'outline'}
                            className={cn(
                              'w-[200px] justify-start text-left font-normal',
                              !payment.paymentDate && 'text-muted-foreground',
                              userRole !== 'bookkeeper' && 'opacity-50 cursor-not-allowed'
                            )}
                            disabled={loan.status === 'fully-paid' || userRole !== 'bookkeeper'}
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
                    <TableCell className="text-right">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-medium">
                          {payment.actualAmountPaid ? formatCurrency(payment.actualAmountPaid) : '—'}
                        </span>
                        {userRole === 'bookkeeper' && loan.status !== 'fully-paid' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingPaymentId(payment.id);
                              setEditAmount(payment.actualAmountPaid || '');
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {comparison && (
                          <span className={`text-xs font-semibold ${comparison.color}`}>
                            {comparison.label}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn('text-right font-medium', penalty > 0 && 'text-destructive')}
                    >
                      {formatCurrency(penalty)}
                    </TableCell>
                    <TableCell className="text-center">
                      {penalty > 0 && !payment.penaltyWaived && !payment.penaltyDenied && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={loan.status === 'fully-paid' || !['approver', 'admin', 'creditCommitteeOfficer', 'creditCommitteeMember'].includes(userRole || '')}
                              className={!['approver', 'admin', 'creditCommitteeOfficer', 'creditCommitteeMember'].includes(userRole || '') ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleWaivePenalty(payment.id)}>
                              Waive
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDenyPenalty(payment.id, payment.paymentNumber)}>
                              Deny
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {(payment.penaltyWaived || payment.penaltyDenied) && (
                        <span className="text-xs text-muted-foreground">
                          {payment.penaltyWaived ? 'Waived' : 'Deferred'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {/* SHADOW ROW FOR SHORTFALL */}
              {totalShortfall > 0 && (
                <TableRow className="bg-orange-50/50 hover:bg-orange-50/80">
                  <TableCell className="font-bold text-orange-800">Audit</TableCell>
                  <TableCell colSpan={2} className="text-orange-800 italic font-medium">
                    Historical Shortfall & Double 2% (4%) Surcharge
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {/* Final surcharge paid */}
                    {loan.final_surcharge_paid ? (
                      <Badge className="bg-green-600">Settled</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-orange-800 font-bold text-xl">
                    {formatCurrency(totalShortfall)}
                  </TableCell>
                  <TableCell className="text-right text-destructive font-bold">
                    {formatCurrency(surchargeAmount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {userRole === 'bookkeeper' && loan.status !== 'fully-paid' && isSurchargePending && (
                       <Button size="sm" variant="destructive" onClick={() => setIsAuditDialogOpen(true)} className="w-full">Settle</Button>
                    )}
                    {!isSurchargePending && <span className="text-sm font-bold text-green-600">Paid</span>}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>

      {/* Edit Amount Dialog */}
      <Dialog open={!!editingPaymentId} onOpenChange={(open) => {
        if (!open) {
          setEditingPaymentId(null);
          setEditAmount('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment Amount</DialogTitle>
            <DialogDescription>
              Enter the actual amount paid for this payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Actual Amount Paid</Label>
              <div className="relative flex items-center">
                <span className="absolute left-2 text-muted-foreground">₱</span>
                <Input
                  id="edit-amount"
                  type="number"
                  placeholder="0.00"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="pl-6"
                  autoFocus
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingPaymentId(null);
              setEditAmount('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleEditAmountSave}>
              Save Amount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle Audit Surcharge Dialog */}
      <Dialog open={isAuditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAuditDialogOpen(false);
          setAuditPaymentAmount('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settle Surcharge Offset</DialogTitle>
            <DialogDescription>
              Enter the amount collected to offset the historical shortfall & penalty. 
              Total Required: <span className="font-bold text-destructive">{formatCurrency(surchargeAmount - (loan.final_surcharge_paid || 0))}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="audit-amount">Amount Settled</Label>
              <div className="relative flex items-center">
                <span className="absolute left-2 text-muted-foreground">₱</span>
                <Input
                  id="audit-amount"
                  type="number"
                  placeholder="0.00"
                  value={auditPaymentAmount}
                  onChange={(e) => setAuditPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="pl-6"
                  autoFocus
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsAuditDialogOpen(false);
              setAuditPaymentAmount('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleSettleSurcharge}>
              Confirm Settle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
