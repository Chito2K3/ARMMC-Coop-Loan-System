"use client";

import * as React from "react";
import Link from "next/link";
import { PlusCircle, ArrowUpDown, MoreHorizontal } from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LoanSerializable, LoanStatus } from "@/lib/types";
import { StatusBadge } from "./status-badge";
import { LoanFormSheet } from "./loan-form-sheet";
import { format } from "date-fns";

type SortConfig = {
  key: "createdAt" | "updatedAt" | "amount" | "applicantName";
  direction: "asc" | "desc";
};

export function DashboardClient({
  initialLoans,
}: {
  initialLoans: LoanSerializable[];
}) {
  const [loans, setLoans] = React.useState(initialLoans);
  const [statusFilter, setStatusFilter] = React.useState<"all" | LoanStatus>(
    "all"
  );
  const [sortConfig, setSortConfig] = React.useState<SortConfig>({
    key: "createdAt",
    direction: "desc",
  });
  const [isCreateSheetOpen, setCreateSheetOpen] = React.useState(false);

  React.useEffect(() => {
    setLoans(initialLoans);
  }, [initialLoans]);

  const sortedAndFilteredLoans = React.useMemo(() => {
    let filtered =
      statusFilter === "all"
        ? [...loans]
        : loans.filter((loan) => loan.status === statusFilter);

    return filtered.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === "createdAt" || sortConfig.key === "updatedAt") {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [loans, statusFilter, sortConfig]);
  
  const handleSort = (key: SortConfig['key']) => {
    setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getSortIndicator = (key: SortConfig['key']) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'desc' ? ' ▼' : ' ▲';
  };

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
          <PlusCircle className="h-4 w-4 mr-2" />
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
                <TableHead onClick={() => handleSort('applicantName')} className="cursor-pointer">
                  Applicant{getSortIndicator('applicantName')}
                </TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden sm:table-cell text-right" onClick={() => handleSort('amount')} className="cursor-pointer">
                  Amount{getSortIndicator('amount')}
                </TableHead>
                <TableHead className="hidden md:table-cell text-right" onClick={() => handleSort('createdAt')} className="cursor-pointer">
                  Created At{getSortIndicator('createdAt')}
                </TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAndFilteredLoans.length > 0 ? (
                sortedAndFilteredLoans.map((loan) => (
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
                          <DropdownMenuItem>Mark as Approved</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Deny
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No loans found.
                  </TableCell>
                </TableRow>
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
