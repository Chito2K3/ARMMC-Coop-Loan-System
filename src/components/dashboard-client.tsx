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
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, Timestamp } from "firebase/firestore";
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
  const [isCreateSheetOpen, setCreateSheetOpen] = React.useState(false);

  const loansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const baseQuery = collection(firestore, 'loans');
    return query(baseQuery, orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: rawLoans, isLoading } = useCollection<Loan>(loansQuery);

  const loans = React.useMemo(() => {
    if (!rawLoans) return [];
    // The data from Firestore might not have the methods on the Timestamps
    // when it's first coming through, so we need to handle that.
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
  

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Loan Dashboard</h1>
          <p className="text-muted-foreground">
            Manage all loan applications here.
          </p>
        </div>
        <Button onClick={() => setCreateSheetOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Loan
        </Button>
      </div>

      <Card>
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
                          <DropdownMenuItem asChild>
                            <Link href={`/loan/${loan.id}`}>View Details</Link>
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
                      No loans found.
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <LoanFormSheet
        open={isCreateSheetOpen}
        onOpenChange={setCreateSheetOpen}
      />
    </>
  );
}
