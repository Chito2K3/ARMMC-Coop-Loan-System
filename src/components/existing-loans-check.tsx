"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Loan } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import { Skeleton } from "./ui/skeleton";

interface ExistingLoansCheckProps {
  applicantName: string;
  currentLoanId: string;
}

export function ExistingLoansCheck({
  applicantName,
  currentLoanId,
}: ExistingLoansCheckProps) {
  const firestore = useFirestore();

  const existingLoansQuery = useMemoFirebase(() => {
    if (!firestore || !applicantName || !currentLoanId) return null;
    return query(
      collection(firestore, "loans"),
      where("applicantName", "==", applicantName),
      where("status", "in", ["approved", "released"])
    );
  }, [firestore, applicantName, currentLoanId]);

  const { data: loans, isLoading } = useCollection<Loan>(existingLoansQuery);

  const existingLoans = loans?.filter(loan => loan.id !== currentLoanId);

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (!existingLoans || existingLoans.length === 0) {
    return null; // Don't show anything if there are no other active loans
  }

  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Applicant has existing loans</AlertTitle>
      <AlertDescription>
        This applicant has {existingLoans.length} other active loan(s). Please
        review their history before approving.
      </AlertDescription>
    </Alert>
  );
}
