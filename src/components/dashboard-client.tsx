'use client';

import * as React from 'react';
import Link from 'next/link';
import { PlusCircle, ChevronLeft, TrendingUp, Clock, CheckCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Loan } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { LoanFormSheet } from './loan-form-sheet';
import { ApprovalPanel } from './approval-panel';
import { SalaryInputPanel } from './salary-input-panel';
import { PastDuePanel } from './past-due-panel';
import { PenaltyPanel } from './penalty-panel';
import { ReleasePanel } from './release-panel';
import { LoanDetailView } from './loan-detail-view';
import { format } from 'date-fns';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, Timestamp, doc, getDoc, getDocs, where } from 'firebase/firestore';
import { Skeleton } from './ui/skeleton';
import { useApprovalPanel } from './approval-context';

interface DashboardClientProps {
  showApprovalPanel?: boolean;
  onShowApprovalPanel?: (show: boolean) => void;
}

export function DashboardClient({ showApprovalPanel = false, onShowApprovalPanel }: DashboardClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { showSalaryInputPanel, setShowSalaryInputPanel, showPastDuePanel, setShowPastDuePanel, showPenaltyPanel, setShowPenaltyPanel, showReleasePanel, setShowReleasePanel } = useApprovalPanel();
  const [isCreateSheetOpen, setCreateSheetOpen] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = React.useState(true);
  const [selectedLoanId, setSelectedLoanId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');

  React.useEffect(() => {
    if (!user) {
      setIsLoadingRole(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        const userRef = doc(firestore, 'users', user.uid);
        let userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          const usersRef = collection(firestore, 'users');
          const q = query(usersRef, where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            userSnap = querySnapshot.docs[0];
          }
        }
        
        if (userSnap.exists()) {
          setUserRole(userSnap.data().role);
        }
      } catch (err) {
        console.error('Failed to fetch user role:', err);
      } finally {
        setIsLoadingRole(false);
      }
    };

    fetchUserRole();
  }, [user, firestore]);

  React.useEffect(() => {
    if (showApprovalPanel || showSalaryInputPanel || showPastDuePanel || showPenaltyPanel || showReleasePanel) {
      setSelectedLoanId(null);
    }
  }, [showApprovalPanel, showSalaryInputPanel, showPastDuePanel, showPenaltyPanel, showReleasePanel]);

  const loansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const baseQuery = collection(firestore, 'loans');
    return query(baseQuery, orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: rawLoans, isLoading, error: loansError } = useCollection<Loan>(loansQuery);

  const loans = React.useMemo(() => {
    if (!rawLoans) return [];
    return rawLoans.map(loan => {
      const createdAtDate = loan.createdAt && (loan.createdAt as any).seconds
        ? new Timestamp((loan.createdAt as any).seconds, (loan.createdAt as any).nanoseconds).toDate()
        : new Date();
      return {
        ...loan,
        createdAt: createdAtDate,
      };
    });
  }, [rawLoans]);

  const filteredLoans = React.useMemo(() => {
    return loans.filter(loan => {
      const matchesSearch = loan.applicantName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [loans, searchTerm, statusFilter]);

  const stats = React.useMemo(() => {
    return {
      total: loans.length,
      pending: loans.filter(l => l.status === 'pending').length,
      approved: loans.filter(l => l.status === 'approved').length,
      released: loans.filter(l => l.status === 'released').length,
    };
  }, [loans]);

  const canCreateLoan = userRole !== 'payrollChecker' && userRole !== 'approver' || userRole === 'admin';
  const showPanel = showApprovalPanel || showSalaryInputPanel || showPastDuePanel || showPenaltyPanel || showReleasePanel;

  if ((showApprovalPanel || showSalaryInputPanel || showPastDuePanel || showPenaltyPanel || showReleasePanel) && selectedLoanId) {
    return <LoanDetailView loanId={selectedLoanId} onBack={() => setSelectedLoanId(null)} />;
  }

  const handleBackToDashboard = () => {
    onShowApprovalPanel?.(false);
    setShowSalaryInputPanel(false);
    setShowPastDuePanel(false);
    setShowPenaltyPanel(false);
    setShowReleasePanel(false);
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        {showPanel && (
          <div className="w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToDashboard}
              className="mb-4"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="grid grid-cols-1 gap-6">
              {showApprovalPanel && (
                <ApprovalPanel onSelectLoan={setSelectedLoanId} selectedLoanId={selectedLoanId} />
              )}
              {showSalaryInputPanel && (
                <SalaryInputPanel onSelectLoan={setSelectedLoanId} selectedLoanId={selectedLoanId} />
              )}
              {showPastDuePanel && (
                <PastDuePanel onSelectLoan={setSelectedLoanId} selectedLoanId={selectedLoanId} />
              )}
              {showPenaltyPanel && (
                <PenaltyPanel onSelectLoan={setSelectedLoanId} selectedLoanId={selectedLoanId} />
              )}
              {showReleasePanel && (
                <ReleasePanel onSelectLoan={setSelectedLoanId} selectedLoanId={selectedLoanId} />
              )}
            </div>
          </div>
        )}

        <div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Loan Dashboard</h1>
              <p className="text-muted-foreground text-sm md:text-base">
                Manage all loan applications here.
              </p>
            </div>
            {!isLoadingRole && canCreateLoan && (
              <Button onClick={() => setCreateSheetOpen(true)} className="w-full md:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Loan
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Loans</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-primary/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-600/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                    <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600/20" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Released</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.released}</p>
                  </div>
                  <Zap className="h-8 w-8 text-blue-600/20" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Input
              placeholder="Search by applicant name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="released">Released</SelectItem>
                <SelectItem value="fully-paid">Fully Paid</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loansError ? (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="h-24 flex flex-col items-center justify-center text-center">
                  <p className="text-destructive font-semibold mb-2">Error Loading Loans</p>
                  <p className="text-sm text-muted-foreground">Failed to load loan data. Please try again later.</p>
                </div>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-32 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredLoans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLoans.map((loan) => (
                <Link key={loan.id} href={`/loan/${loan.id}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-primary">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Loan #{loan.loanNumber}</p>
                          <p className="text-lg font-semibold">{loan.applicantName}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Amount</p>
                            <p className="text-xl font-bold">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'PHP',
                              }).format(loan.amount)}
                            </p>
                          </div>
                          <StatusBadge status={loan.status} />
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            {format(loan.createdAt, 'PPp')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="h-24 flex flex-col items-center justify-center text-center">
                  <p className="text-muted-foreground mb-4">No loans found.</p>
                  {!isLoadingRole && canCreateLoan && (
                    <Button variant="outline" size="sm" onClick={() => setCreateSheetOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Loan
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {!isLoadingRole && canCreateLoan && (
        <LoanFormSheet
          open={isCreateSheetOpen}
          onOpenChange={setCreateSheetOpen}
        />
      )}
    </>
  );
}
