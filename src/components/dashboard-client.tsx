'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFirestore, useUser } from '@/firebase/provider';
import { useApprovalPanel } from './approval-context';
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { useCollection, useMemoFirebase } from '@/firebase';
import { Loan } from '@/lib/types';
import { LoanDetailView } from './loan-detail-view-new';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Plus, Search, Filter, PlusCircle } from 'lucide-react';
import { ApprovalPanel } from './approval-panel';
import { SalaryInputPanel } from './salary-input-panel';
import { PastDuePanel } from './past-due-panel';
import { ReleasePanel } from './release-panel';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { StatusBadge } from './status-badge';
import { LoanFormSheet } from './loan-form-sheet';
import { cn } from '@/lib/utils';

interface DashboardClientProps {
  showApprovalPanel?: boolean;
  onShowApprovalPanel?: (show: boolean) => void;
}

export function DashboardClient({ showApprovalPanel = false, onShowApprovalPanel }: DashboardClientProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { 
    showSalaryInputPanel, setShowSalaryInputPanel, 
    showPastDuePanel, setShowPastDuePanel, 
    showReleasePanel, setShowReleasePanel,
    selectedLoanId, setSelectedLoanId 
  } = useApprovalPanel();
  const [isCreateSheetOpen, setCreateSheetOpen] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = React.useState(true);
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
            userSnap = querySnapshot.docs[0] as any;
          }
        }

        if (userSnap.exists()) {
          setUserRole(userSnap.data()?.role);
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
    if (showApprovalPanel || showSalaryInputPanel || showPastDuePanel || showReleasePanel) {
      setSelectedLoanId(null);
    }
  }, [showApprovalPanel, showSalaryInputPanel, showPastDuePanel, showReleasePanel]);

  const loansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const baseQuery = collection(firestore, 'loans');
    return query(baseQuery, orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: rawLoans, isLoading, error: loansError } = useCollection<Loan>(loansQuery);

  const loans = React.useMemo(() => {
    if (!rawLoans) return [];
    return rawLoans.map(loan => {
      let createdAtDate: Date;
      if (loan.createdAt instanceof Timestamp) {
        createdAtDate = loan.createdAt.toDate();
      } else if (loan.createdAt instanceof Date) {
        createdAtDate = loan.createdAt;
      } else if (loan.createdAt && typeof (loan.createdAt as any).seconds === 'number') {
        createdAtDate = new Timestamp((loan.createdAt as any).seconds, (loan.createdAt as any).nanoseconds || 0).toDate();
      } else {
        createdAtDate = new Date();
      }
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

  const canCreateLoan = userRole === 'admin' || userRole === 'bookkeeper';
  const showPanel = showApprovalPanel || showSalaryInputPanel || showPastDuePanel || showReleasePanel;

  if (selectedLoanId) {
    return <LoanDetailView loanId={selectedLoanId} onBack={() => setSelectedLoanId(null)} />;
  }

  const handleBackToDashboard = () => {
    onShowApprovalPanel?.(false);
    setShowSalaryInputPanel(false);
    setShowPastDuePanel(false);
    setShowReleasePanel(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  return (
    <>
      <div className="flex flex-col gap-8 max-w-[1600px] mx-auto">
        {showPanel && (
          <div className="w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToDashboard}
              className="mb-4 hover:bg-white border-[#E2E8F0] border"
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
              {showReleasePanel && (
                <ReleasePanel onSelectLoan={setSelectedLoanId} selectedLoanId={selectedLoanId} />
              )}
            </div>
          </div>
        )}

        {/* Dashboard Title & Quick Stats */}
        {!showPanel && (
          <>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#1A1A1A]">Loan Dashboard</h1>
                <p className="text-muted-foreground mt-1">
                  Cooperative ledger and application management.
                </p>
              </div>
              {!isLoadingRole && canCreateLoan && (
                <Button 
                  onClick={() => setCreateSheetOpen(true)} 
                  className="bg-primary hover:bg-primary/90 shadow-none px-6"
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Loan Application
                </Button>
              )}
            </div>

            {/* Flat Quick-Filter Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'All Applications', count: stats.total, value: 'all', color: 'border-[#E2E8F0]' },
                { label: 'Pending Approval', count: stats.pending, value: 'pending', color: 'border-orange-200 text-orange-700 bg-orange-50/50' },
                { label: 'Approved', count: stats.approved, value: 'approved', color: 'border-green-200 text-green-700 bg-green-50/50' },
                { label: 'Funds Released', count: stats.released, value: 'released', color: 'border-blue-200 text-blue-700 bg-blue-50/50' },
              ].map((stat) => (
                <button
                  key={stat.value}
                  onClick={() => setStatusFilter(stat.value)}
                  className={cn(
                    "flex flex-col p-4 text-left border rounded-lg transition-all hover:bg-white hover:border-primary/30",
                    statusFilter === stat.value ? "ring-2 ring-primary ring-offset-2 border-primary" : stat.color,
                    "bg-white"
                  )}
                >
                  <span className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{stat.label}</span>
                  <span className="text-2xl font-bold">{stat.count}</span>
                </button>
              ))}
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Input
                  placeholder="Search by applicant name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white border-[#E2E8F0] h-11 pl-4 shadow-none"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-56 h-11 bg-white border-[#E2E8F0] shadow-none">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                  <SelectItem value="fully-paid">Fully Paid</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* The Modern Ledger (Table) */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
              {loansError ? (
                <div className="p-12 flex flex-col items-center text-center">
                  <p className="text-destructive font-semibold">Error Loading Ledger</p>
                  <p className="text-sm text-muted-foreground mt-1">Please try refreshing the page.</p>
                </div>
              ) : isLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                  ))}
                </div>
              ) : filteredLoans.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-[#F8FAFC]">
                      <TableRow className="hover:bg-transparent border-b-[#E2E8F0]">
                        <TableHead className="w-[100px] py-4 font-bold text-[#1A1A1A]">#</TableHead>
                        <TableHead className="py-4 font-bold text-[#1A1A1A]">Applicant Name</TableHead>
                        <TableHead className="py-4 font-bold text-[#1A1A1A]">Loan Type</TableHead>
                        <TableHead className="text-right py-4 font-bold text-[#1A1A1A]">Amount</TableHead>
                        <TableHead className="py-4 font-bold text-[#1A1A1A]">Applied Date</TableHead>
                        <TableHead className="py-4 font-bold text-[#1A1A1A]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLoans.map((loan) => (
                        <TableRow 
                          key={loan.id}
                          onClick={() => setSelectedLoanId(loan.id)}
                          className="cursor-pointer hover:bg-primary/5 transition-colors group even:bg-[#F7F8FA]/50"
                        >
                          <TableCell className="font-medium text-muted-foreground">
                            {loan.loanNumber}
                          </TableCell>
                          <TableCell className="font-semibold text-[#1A1A1A] group-hover:text-primary">
                            {loan.applicantName}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {loan.loanType}
                          </TableCell>
                          <TableCell className="text-right font-bold text-[#1A1A1A]">
                            {formatCurrency(loan.amount)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(loan.createdAt, 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={loan.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="p-16 flex flex-col items-center text-center">
                  <p className="text-muted-foreground">No records found matching your criteria.</p>
                  <Button 
                    variant="link" 
                    onClick={() => { setSearchTerm(''); setStatusFilter('all'); }} 
                    className="mt-2 text-primary"
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
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
