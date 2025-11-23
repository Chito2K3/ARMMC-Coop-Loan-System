"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFirestore } from "@/firebase";
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import type { LoanSerializable, LoanType, LoanPurpose } from "@/lib/types";

const paymentTermOptions = [1, 3, 4, 6, 9, 12, 18, 24];
const loanTypeOptions: LoanType[] = ["Cash Advance", "Multi-Purpose", "Emergency"];
const loanPurposeOptions: LoanPurpose[] = [
  "Business Capital",
  "Bills Payment",
  "Tuition Fee",
  "House Renovation",
  "Medical Expenses",
  "Travel Expenses",
];

const loanFormSchema = z.object({
  applicantName: z.string().min(2, {
    message: "Applicant name must be at least 2 characters.",
  }),
  amount: z.coerce
    .number({ invalid_type_error: "Please enter a valid number." })
    .positive("Loan amount must be positive."),
  paymentTerm: z.coerce.number().refine((val) => paymentTermOptions.includes(val), {
    message: "Please select a valid payment term.",
  }),
  loanType: z.enum(loanTypeOptions, {
    errorMap: () => ({ message: "Please select a valid loan type." }),
  }),
  purpose: z.enum(loanPurposeOptions, {
    errorMap: () => ({ message: "Please select a valid purpose." }),
  }),
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
  const { toast } = useToast();

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(loanFormSchema),
    defaultValues: isEditMode
      ? {
          applicantName: loan.applicantName,
          amount: loan.amount,
          paymentTerm: loan.paymentTerm,
          loanType: loan.loanType,
          purpose: loan.purpose,
          remarks: loan.remarks || "",
        }
      : {
          applicantName: "",
          amount: 0,
          paymentTerm: 6,
          loanType: "Cash Advance",
          purpose: "Bills Payment",
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
          ...data,
          updatedAt: serverTimestamp(),
        });
        toast({
          title: "Loan Update In Progress",
          description: "The loan application is being updated.",
        });
      } else {
        const newLoan = {
          ...data,
          salary: 0,
          status: "pending" as const,
          bookkeeperChecked: false,
          payrollChecked: false,
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
      <SheetContent className="sm:max-w-lg flex flex-col">
        <SheetHeader>
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
            <form
              id="loan-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex-1 flex flex-col min-h-0"
            >
              <ScrollArea className="flex-1 pr-6 -mr-6">
                <div className="space-y-6 py-4">
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
                    name="loanType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type of Loan</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a loan type" />
                            </Trigger>
                          </FormControl>
                          <SelectContent>
                            {loanTypeOptions.map(type => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purpose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purpose</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a purpose" />
                            </Trigger>
                          </FormControl>
                          <SelectContent>
                            {loanPurposeOptions.map(purpose => (
                              <SelectItem key={purpose} value={purpose}>
                                {purpose}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentTerm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Term (Months)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a payment term" />
                            </Trigger>
                          </FormControl>
                          <SelectContent>
                            {paymentTermOptions.map(term => (
                              <SelectItem key={term} value={String(term)}>
                                {term} month{term > 1 ? 's' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                </div>
              </ScrollArea>
              {/* This is the change */}
              <SheetFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  <span>{isEditMode ? "Save Changes" : "Create Loan"}</span>
                </Button>
              </SheetFooter>
            </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
