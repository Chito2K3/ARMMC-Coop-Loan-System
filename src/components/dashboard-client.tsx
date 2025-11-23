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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LoanSerializable, LoanStatus } from "@/lib/types";
import { StatusBadge } from "./status-badge";
import { LoanFormSheet } from "./loan-form-sheet";
import { format } from "date-fns";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Skeleton } from "./ui/skeleton";

export function DashboardClient() {
  const firestore = useFirestore();
  const [statusFilter, setStatusFilter] = React.useState<"all" | LoanStatus>(
    "all"
  );
  const [isCreateSheetOpen, setCreateSheetOpen] = React.useState(false);

  const loansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const baseQuery = collection(firestore, 'loans');
    if (statusFilter !== 'all') {
      return query(baseQuery, where('status', '==', statusFilter), orderBy('createdAt', 'desc'));
    }
    return query(baseQuery, orderBy('createdAt', 'desc'));
  }, [firestore, statusFilter]);

  const { data: loans, isLoading } = useCollection<LoanSerializable>(loansQuery);

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
          <Tabs
            defaultValue="all"
            onValueChange={(value) =>
              setStatusFilter(value as "all" | LoanStatus)
            }
            className="pt-4"
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="denied">Denied</TabsTrigger>
              <TabsTrigger value="released">Released</TabsTrigger>
            </TabsList>
          </Tabs>
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
                      {format(new Date(loan.createdAt), "PPpp")}
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
                      No loans found for the selected status.
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
