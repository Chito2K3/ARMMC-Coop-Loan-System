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

const ensureDate = (dateVal: any): Date | undefined => {
  if (!dateVal) return undefined;
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'string') return new Date(dateVal);
  if (dateVal.toDate && typeof dateVal.toDate === 'function') return dateVal.toDate();
  if (dateVal.seconds) return new Timestamp(dateVal.seconds, dateVal.nanoseconds || 0).toDate();
  return undefined;
};

export function CollectionSchedule({ loan, userRole }: CollectionScheduleProps) {
  const firestore = useFirestore();
  const [editingPaymentId, setEditingPaymentId] = React.useState<string | null>(null);
  const [editAmount, setEditAmount] = React.useState<number | string>(0);
  
  const [isEditingSurcharge, setIsEditingSurcharge] = React.useState(false);
  const [surchargePaidInput, setSurchargePaidInput] = React.useState<number | string>(loan.final_surcharge_paid || 0);

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

  // Surcharge payment tracking
  const localShortfall = React.useMemo(() => payments.reduce((acc, p) => {
    if (p.status === 'paid' && p.actualAmountPaid !== undefined) {
      return acc + Math.max(0, p.amount - p.actualAmountPaid);
    }
    return acc;
  }, 0), [payments]);

  const effectiveShortfallBucket = Math.max(loan.historical_shortfall_bucket || 0, localShortfall);
  // Full Settlement Logic: Total Principal Shortfalls + 2% Monthly Penalty + 2% Maturity Surchage (Total 104%)
  const finalSurchargeTotal = (effectiveShortfallBucket * 1.04) || 0;
  const isSurchargeRequired = effectiveShortfallBucket > 0.01; 
  const isSurchargePaid = (loan.final_surcharge_paid || 0) >= finalSurchargeTotal - 0.01;

  const completedPayments = payments.filter(p => p.status === 'paid').length;
  const currentMonth = completedPayments + 1;
  const allPaymentsDone = completedPayments === loan.paymentTerm;
  const showShadowRow = (currentMonth >= loan.paymentTerm - 1 || allPaymentsDone) && isSurchargeRequired;

  const handleSurchargeDateChange = async (date: Date | undefined) => {
    if (!firestore || !date) return;

    try {
      const loanRef = doc(firestore, 'loans', loan.id);
      await updateDocumentNonBlocking(loanRef, {
        final_surcharge_date: Timestamp.fromDate(date),
        updatedAt: serverTimestamp(),
      });

      toast({
        title: 'Surcharge Payment Date Updated',
        description: 'Please record the actual amount paid to complete the audit.',
      });
    } catch (error) {
      console.error('Error updating surcharge date:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update surcharge payment date.',
        variant: 'destructive',
      });
    }
  };

  const checkAndCloseLoan = async (updatedPayments: Payment[], newSurchargePaid: number) => {
    const allPaid = updatedPayments.every(p => p.status === 'paid');
    
    // Recalculate local shortfall from updatedPayments for immediate feedback
    const updatedLocalShortfall = updatedPayments.reduce((acc, p) => {
      if (p.status === 'paid' && p.actualAmountPaid !== undefined) {
        return acc + Math.max(0, p.amount - p.actualAmountPaid);
      }
      return acc;
    }, 0);
    
    const updatedEffectiveBucket = Math.max(loan.historical_shortfall_bucket || 0, updatedLocalShortfall);
    // Full Settlement Logic: Total Principal Shortfalls + 4% Total Surcharge
    const updatedSurchargeTotal = (updatedEffectiveBucket * 1.04) || 0;
    const updatedSurchargeRequired = updatedEffectiveBucket > 0.01;
    const hasUnpaidSurcharge = updatedSurchargeRequired && newSurchargePaid < updatedSurchargeTotal - 0.01;
    
    if (allPaid && !hasUnpaidSurcharge) {
      const loanRef = doc(firestore!, 'loans', loan.id);
      await updateDocumentNonBlocking(loanRef, { status: 'fully-paid' });
      toast({
        title: 'Loan Fully Paid!',
        description: 'Congratulations! This loan has been fully paid.',
        className: 'bg-green-100 text-green-800 border-green-200'
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

      // If we have an actual amount, we can mark as paid. 
      // Status will be 'paid', and if paymentDate is missing, we'll set it later in the update.
      if (actualAmount <= 0) {
        toast({
          title: 'Invalid Entry',
          description: 'Please enter a payment amount.',
          variant: 'destructive',
        });
        return;
      }

      const paymentRef = doc(firestore, 'loans', loan.id, 'payments', paymentId);
      const updates: any = {
        actualAmountPaid: actualAmount,
        status: 'paid',
        updatedAt: serverTimestamp(),
      };

      if (!payment.paymentDate) {
        updates.paymentDate = serverTimestamp();
      }

      await updateDocumentNonBlocking(paymentRef, updates);

      toast({
        title: 'Actual Amount Recorded',
        description: 'Payment has been marked as complete.',
      });

      const updatedPayments = payments.map(p => 
        p.id === paymentId ? { ...p, status: 'paid' as const, actualAmountPaid: actualAmount } : p
      );
      await checkAndCloseLoan(updatedPayments, loan.final_surcharge_paid || 0);
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
    if (!editingPaymentId || Number(editAmount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid amount.',
        variant: 'destructive',
      });
      return;
    }

    const payment = payments.find(p => p.id === editingPaymentId);
    if (!payment) {
      setEditingPaymentId(null);
      return;
    }

    try {
      const paymentRef = doc(firestore, 'loans', loan.id, 'payments', editingPaymentId);
      const updates: any = {
        actualAmountPaid: Number(editAmount),
        status: 'paid',
        updatedAt: serverTimestamp(),
      };

      if (!payment.paymentDate) {
        updates.paymentDate = serverTimestamp();
      }

      await updateDocumentNonBlocking(paymentRef, updates);

      toast({
        title: 'Amount Updated',
        description: 'Actual paid amount has been recorded.',
      });

      setEditingPaymentId(null);
      setEditAmount(0);

      const updatedPayments = payments.map(p => 
        p.id === editingPaymentId ? { ...p, status: 'paid' as const, actualAmountPaid: Number(editAmount) } : p
      );
      await checkAndCloseLoan(updatedPayments, loan.final_surcharge_paid || 0);
    } catch (error) {
      console.error('Error updating amount:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update amount. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSurchargePaidSave = async () => {
    if (!firestore || Number(surchargePaidInput) < 0) return;
    
    try {
      const loanRef = doc(firestore, 'loans', loan.id);
      await updateDocumentNonBlocking(loanRef, {
        final_surcharge_paid: Number(surchargePaidInput),
        final_surcharge_total: finalSurchargeTotal,
        updatedAt: serverTimestamp(),
      });
      
      toast({
        title: 'Surcharge Payment Updated',
        description: 'The audit surcharge payment has been recorded.',
      });
      
      setIsEditingSurcharge(false);
      await checkAndCloseLoan(payments, Number(surchargePaidInput));
    } catch (error) {
      console.error('Error updating surcharge:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update surcharge amount.',
        variant: 'destructive',
      });
    }
  };

  const getPaymentStatus = (payment: (typeof payments)[0]) => {
    if (payment.remarks === 'Deducted from proceeds') {
      return <Badge className="bg-blue-600 hover:bg-blue-700">Deducted</Badge>;
    }
    if (payment.paymentDate) {
      return <Badge className="bg-green-600 hover:bg-green-700">Paid</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  const getPaymentComparison = (payment: (typeof payments)[0]) => {
    if (!payment.actualAmountPaid) return null;

    const difference = Math.round((payment.actualAmountPaid - payment.amount) * 100) / 100;

    if (Math.abs(difference) < 0.01) {
      return { label: '✓ Full', color: 'text-green-400' };
    } else if (difference < 0) {
      return { label: `⚠️ Short ₱${Math.abs(difference).toLocaleString()}`, color: 'text-amber-400' };
    } else {
      return { label: `ℹ️ Change ₱${difference.toLocaleString()}`, color: 'text-blue-400' };
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collection Schedule</CardTitle>
        <CardDescription>
          Manage monthly payments and actual amounts paid.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {currentMonth === loan.paymentTerm - 1 && isSurchargeRequired && (
          <div className="mb-4 p-4 bg-orange-50 border border-orange-200 text-orange-800 rounded-lg text-sm font-medium flex items-center gap-2">
            ⚠️ System Audit: A "Double 2%" penalty (₱{formatCurrency(finalSurchargeTotal)}) will be added to your final settlement due to previous shortfalls (2% Monthly + 2% Maturity).
          </div>
        )}
        
        <ScrollArea className="h-96 w-full rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actual Paid</TableHead>
                <TableHead className="text-right">Shortfall</TableHead>
                <TableHead className="text-right">Penalty(2%)</TableHead>
                <TableHead className="text-right">Total Debt</TableHead>
                <TableHead className="text-center">Actions</TableHead>
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
                  <TableCell colSpan={6} className="h-24 text-center">
                    No payment schedule found.
                  </TableCell>
                </TableRow>
              )}
              {payments.map((payment) => {
                const shortfall = payment.status === 'paid' ? Math.max(0, payment.amount - (payment.actualAmountPaid || 0)) : 0;
                const monthlyPenalty = shortfall * 0.02;
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
                      {payment.remarks === 'Deducted from proceeds' ? (
                        <div className="flex items-center gap-2 text-sm text-blue-400 font-medium italic px-2">
                          <span>Deducted at Release</span>
                        </div>
                      ) : (
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
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-medium">
                          {payment.actualAmountPaid ? formatCurrency(payment.actualAmountPaid) : '—'}
                        </span>
                        {userRole === 'bookkeeper' && loan.status !== 'fully-paid' && payment.remarks !== 'Deducted from proceeds' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingPaymentId(payment.id);
                              setEditAmount(payment.actualAmountPaid || 0);
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
                    <TableCell className="text-right text-amber-500 font-medium">
                      {shortfall > 0 ? formatCurrency(shortfall) : '—'}
                    </TableCell>
                    <TableCell
                      className={cn('text-right font-medium', monthlyPenalty > 0 && 'text-red-400')}
                    >
                      {monthlyPenalty > 0 ? formatCurrency(monthlyPenalty) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-bold text-amber-400">
                      {shortfall > 0 ? formatCurrency(shortfall + monthlyPenalty) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-muted-foreground">
                        {monthlyPenalty > 0 ? 'Recorded' : 'None'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
              
              {/* Shadow Row: Audit Maturity Surcharge */}
              {showShadowRow && (
                <TableRow key="shadow-row-surcharge" className="bg-amber-950/20 border-t-2 border-amber-500/50">
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-[200px] justify-start text-left font-normal',
                            !loan.final_surcharge_date && 'text-muted-foreground',
                            !(userRole?.toLowerCase() === 'bookkeeper' || userRole?.toLowerCase() === 'admin') && 'opacity-50 cursor-not-allowed'
                          )}
                          disabled={userRole?.toLowerCase() !== 'bookkeeper' && userRole?.toLowerCase() !== 'admin'}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {loan.final_surcharge_date ? (
                            format(ensureDate(loan.final_surcharge_date) || new Date(), 'MMM d, yyyy')
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={ensureDate(loan.final_surcharge_date)}
                          onSelect={(date) => handleSurchargeDateChange(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell colSpan={2} className="font-bold text-amber-500">
                    Final Settlement Audit (2% Monthly + 2% Maturity) <br/>
                    <span className="text-xs text-amber-200/70 font-normal">
                      Full Principal Shortfalls + Accumulated 4% Total Surcharge <br/>
                      Based on ₱{(effectiveShortfallBucket).toLocaleString()} total shortfall
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-bold text-amber-500" colSpan={3}>
                    {formatCurrency(finalSurchargeTotal)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {isEditingSurcharge ? (
                        <div className="flex items-center gap-1">
                          <Input 
                            type="number" 
                            className="h-7 w-20 text-right text-xs" 
                            value={surchargePaidInput} 
                            onChange={(e) => setSurchargePaidInput(e.target.value)}
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleSurchargePaidSave}>Save</Button>
                        </div>
                      ) : (
                        <>
                          <span className={isSurchargePaid ? "text-green-400 font-bold" : "text-amber-500"}>
                            {loan.final_surcharge_paid !== undefined ? formatCurrency(loan.final_surcharge_paid) : '—'}
                           </span>
                          {(userRole?.toLowerCase() === 'bookkeeper' || userRole?.toLowerCase() === 'admin') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSurchargePaidInput(loan.final_surcharge_paid || 0);
                                setIsEditingSurcharge(true);
                              }}
                              className="h-6 w-6 p-0 text-amber-500 hover:text-amber-400 hover:bg-amber-950/40"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell colSpan={2}></TableCell>
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
          setEditAmount(0);
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
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="pl-6"
                  autoFocus
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingPaymentId(null);
              setEditAmount(0);
            }}>
              Cancel
            </Button>
            <Button onClick={handleEditAmountSave}>
              Save Amount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
