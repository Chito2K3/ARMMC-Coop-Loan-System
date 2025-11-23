"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import type { LoanSerializable } from "@/lib/types";
import {
  collection,
  doc,
  serverTimestamp,
  getCountFromServer,
} from "firebase/firestore";
import { useFirestore } from "@/firebase";
import { useRouter } from "next/navigation";

const loanFormSchema = z.object({
  applicantName: z.string().min(2, {
    message: "Applicant name must be at least 2 characters.",
  }),
  amount: z.coerce
    .number({ invalid_type_error: "Please enter a valid number." })
    .positive({ message: "Loan amount must be positive." }),
  remarks: z.string().optional(),
});

type LoanFormValues = z.infer<typeof loanFormSchema>;

interface LoanFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan?: LoanSerializable;
}

export function LoanFormSheet({
  open,
  onOpenChange,
  loan,
}: LoanFormSheetProps) {
  const isEditMode = !!loan;
  const firestore = useFirestore();
  const router = useRouter();

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: isEditMode
      ? {
          applicantName: loan.applicantName,
          amount: loan.amount,
          remarks: loan.remarks || "",
        }
      : {
          applicantName: "",
          amount: 0,
          remarks: "",
        },
  });

  async function onSubmit(data: LoanFormValues) {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "An error occurred",
        description: "Firestore is not available.",
      });
      return;
    }
    try {
      if (isEditMode && loan) {
        const loanRef = doc(firestore, "loans", loan.id);
        updateDocumentNonBlocking(loanRef, {
          applicantName: data.applicantName,
          amount: data.amount,
          remarks: data.remarks,
          updatedAt: serverTimestamp(),
        });
        toast({
          title: "Loan Update In Progress",
          description: "The loan application is being updated.",
        });
      } else {
        const loansCollection = collection(firestore, "loans");
        const snapshot = await getCountFromServer(loansCollection);
        const nextLoanNumber = snapshot.data().count + 1;

        const newLoan = {
          ...data,
          No: nextLoanNumber,
          salary: 0,
          status: "pending" as const,
          bookkeeperChecked: false,
          payrollChecked: false,
          approvals: {
            approver1: "pending" as const,
            approver2: "pending" as const,
          },
          denialRemarks: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const docRefPromise = addDocumentNonBlocking(
          collection(firestore, "loans"),
          newLoan
        );
        toast({
          title: "Loan Created",
          description: "The new loan application has been saved.",
        });
        const docRef = await docRefPromise;
        if (docRef && docRef.id) {
          router.push(`/loan/${docRef.id}`);
        }
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "An error occurred",
        description: (error as Error).message,
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader className="mb-4">
          <SheetTitle>
            {isEditMode ? "Edit Loan" : "New Loan Application"}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? "Update the details of the loan application."
              : "Fill out the form to create a new loan application."}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="applicantName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applicant Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan Dela Cruz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loan Amount</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="5000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter any relevant remarks"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                <span>{isEditMode ? "Save Changes" : "Create Loan"}</span>
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
