"use client";

import * as React from "react";
import Link from "next/link";
import { PlusCircle, MoreHorizontal } from "lucide-react";
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
import { format } from "date-fns";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, Timestamp, doc, getDoc, getDocs, where } from "firebase/firestore";
import { Skeleton } from "./ui/skeleton";

// Helper function to convert Firestore Timestamps in a loan object
const convertLoanTimestamps = (loan: Loan) => {
  return {
    ...loan,
    createdAt: (loan.createdAt as unknown as Timestamp)?.toDate
      ? (loan.createdAt as unknown as Timestamp).toDate()
      : new Date(),
    updatedAt: (loan.updatedAt as unknown as Timestamp)?.toDate
      ? (loan.updatedAt as unknown as Timestamp).toDate()
      : new Date(),
  };
};

export function DashboardClient() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [isCreateSheetOpen, setCreateSheetOpen] = React.useState(false);
  const [userRole, setUserRole] = React.useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = React.useState(true);

  React.useEffect(() => {
    if (!user) {
      setIsLoadingRole(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        // First try to get by UID
        const userRef = doc(firestore, 'users', user.uid);
        let userSnap = await getDoc(userRef);
        
        // If not found by UID, search by email
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

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Loan Dashboard</h1>
          <p className="text-muted-foreground">
            Manage all loan applications here.
          </p>
        </div>
        {!isLoadingRole && canCreateLoan && (
          <Button onClick={() => setCreateSheetOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Loan
          </Button>
        )}
      </div>

      <Card className="border-border/50 shadow-xl bg-card/50 backdrop-blur-sm">
        <CardHeader className="px-7">
          <CardTitle>Loan Applications</CardTitle>
          <CardDescription>
            A list of all recent loan applications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden sm:table-cell text-right">
                  Amount
                </TableHead>
                <TableHead className="hidden md:table-cell text-right">
                  Created At
                </TableHead>
                <TableHead>
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
                    <TableCell>
                      <div className="font-medium">{loan.applicantName}</div>
                      <div className="text-sm text-muted-foreground md:hidden">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "PHP",
                        }).format(loan.amount)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <StatusBadge status={loan.status} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-right">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "PHP",
                      }).format(loan.amount)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-right">
                      {format(loan.createdAt, "PPpp")}
                    </TableCell>
                    <TableCell>
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
        </CardContent>
      </Card>
      {!isLoadingRole && canCreateLoan && (
        <LoanFormSheet
          open={isCreateSheetOpen}
          onOpenChange={setCreateSheetOpen}
        />
      )}
    </>
  );
}
