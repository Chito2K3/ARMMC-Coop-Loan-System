"use client";

import * as React from "react";
import Link from "next/link";
import { PlusCircle, MoreHorizontal, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Loan } from "@/lib/types";
import { StatusBadge } from "./status-badge";
import { LoanFormSheet } from "./loan-form-sheet";
import { ApprovalPanel } from "./approval-panel";
import { SalaryInputPanel } from "./salary-input-panel";
import { PastDuePanel } from "./past-due-panel";
import { PenaltyPanel } from "./penalty-panel";
import { ReleasePanel } from "./release-panel";
import { LoanDetailView } from "./loan-detail-view";
import { format } from "date-fns";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, Timestamp, doc, getDoc, getDocs, where } from "firebase/firestore";
import { Skeleton } from "./ui/skeleton";
import { useApprovalPanel } from "./approval-context";

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

  const { data: rawLoans, isLoading } = useCollection<Loan>(loansQuery);

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

  const canCreateLoan = userRole !== 'payrollChecker' && userRole !== 'approver';
  const showPanel = showApprovalPanel || showSalaryInputPanel || showPastDuePanel || showPenaltyPanel || showReleasePanel;

  if ((showApprovalPanel || showSalaryInputPanel || showPastDuePanel || showPenaltyPanel || showReleasePanel) && selectedLoanId) {
    return <LoanDetailView loanId={selectedLoanId} onBack={() => setSelectedLoanId(null)} />;
  }

  return (
    <>
      <div className={`grid gap-6 ${showPanel ? 'md:grid-cols-3' : ''}`}>
        <div className={showPanel ? 'md:col-span-2' : ''}>
          {showPanel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onShowApprovalPanel?.(false);
                setShowSalaryInputPanel(false);
                setShowPastDuePanel(false);
                setShowPenaltyPanel(false);
                setShowReleasePanel(false);
              }}
              className="mb-4"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          )}

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

          <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-sm">
            <CardHeader className="px-4 md:px-7">
              <CardTitle>Loan Applications</CardTitle>
              <CardDescription>
                A list of all recent loan applications.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 md:px-7">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 md:pl-0">Applicant</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="hidden md:table-cell text-right">
                        Amount
                      </TableHead>
                      <TableHead className="hidden lg:table-cell text-right">
                        Created At
                      </TableHead>
                      <TableHead className="pr-4 md:pr-0">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <>
                        <TableRow>
                          <TableCell colSpan={5}>
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={5}>
                            <Skeleton className="h-8 w-full" />
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                    {!isLoading && loans && loans.length > 0 ? (
                      loans.map((loan) => (
                        <TableRow key={loan.id}>
                          <TableCell className="pl-4 md:pl-0">
                            <div className="font-medium text-sm md:text-base">{loan.applicantName}</div>
                            <div className="text-xs text-muted-foreground md:hidden">
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: "PHP",
                              }).format(loan.amount)}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <StatusBadge status={loan.status} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-right">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "PHP",
                            }).format(loan.amount)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-right text-sm">
                            {format(loan.createdAt, "PPpp")}
                          </TableCell>
                          <TableCell className="pr-4 md:pr-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Toggle menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem>
                                  <Link href={`/loan/${loan.id}`} className="w-full h-full">View Details</Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      !isLoading && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="h-24 text-center text-muted-foreground"
                          >
                            <div className="flex flex-col items-center justify-center gap-2">
                              <p>No loans found.</p>
                              {!isLoadingRole && canCreateLoan && (
                                <Button variant="outline" size="sm" onClick={() => setCreateSheetOpen(true)}>
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                  Create Loan
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        {showApprovalPanel && (
          <div className="md:col-span-1">
            <ApprovalPanel onSelectLoan={setSelectedLoanId} selectedLoanId={selectedLoanId} />
          </div>
        )}

        {showSalaryInputPanel && (
          <div className="md:col-span-1">
            <SalaryInputPanel onSelectLoan={setSelectedLoanId} selectedLoanId={selectedLoanId} />
          </div>
        )}

        {showPastDuePanel && (
          <div className="md:col-span-1">
            <PastDuePanel onSelectLoan={setSelectedLoanId} selectedLoanId={selectedLoanId} />
          </div>
        )}

        {showPenaltyPanel && (
          <div className="md:col-span-1">
            <PenaltyPanel onSelectLoan={setSelectedLoanId} selectedLoanId={selectedLoanId} />
          </div>
        )}

        {showReleasePanel && (
          <div className="md:col-span-1">
            <ReleasePanel onSelectLoan={setSelectedLoanId} selectedLoanId={selectedLoanId} />
          </div>
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
