"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { collection, doc, serverTimestamp } from "firebase/firestore";

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
import { getNextLoanNumber } from "@/firebase/counter";
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
  paymentTerm: z.coerce
    .number()
    .refine((val) => paymentTermOptions.includes(val), {
      message: "Please select a valid payment term.",
    }),
  loanType: z.enum(["Cash Advance", "Multi-Purpose", "Emergency"], {
    errorMap: () => ({ message: "Please select a valid loan type." }),
  }),
  purpose: z.enum(["Business Capital", "Bills Payment", "Tuition Fee", "House Renovation", "Medical Expenses", "Travel Expenses"], {
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

export function LoanFormSheet({ open, onOpenChange, loan }: LoanFormSheetProps) {
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
        const loanNumber = await getNextLoanNumber(firestore);

        const newLoan = {
          ...data,
          loanNumber,
          salary: 0,
          status: "pending" as const,
          bookkeeperChecked: true,
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
      <SheetContent className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader className="pb-6">
          <SheetTitle className="text-2xl">
            {isEditMode ? "Edit Loan Application" : "New Loan Application"}
          </SheetTitle>
          <SheetDescription className="text-base">
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
              <div className="space-y-8 py-4 pr-6">
                {/* Applicant Name */}
                <FormField
                  control={form.control}
                  name="applicantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Applicant Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Juan Dela Cruz" 
                          className="h-11 text-base"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Loan Amount */}
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Loan Amount</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">
                            ₱
                          </span>
                          <Input
                            type="number"
                            placeholder="5000"
                            className="pl-10 h-11 text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Loan Type */}
                  <FormField
                    control={form.control}
                    name="loanType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">Type of Loan</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11 text-base">
                              <SelectValue placeholder="Select a loan type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {loanTypeOptions.map((type) => (
                              <SelectItem key={type} value={type} className="text-base">
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Payment Term */}
                  <FormField
                    control={form.control}
                    name="paymentTerm"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">Payment Term (Months)</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(Number(val))}
                          defaultValue={String(field.value)}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11 text-base">
                              <SelectValue placeholder="Select a payment term" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {paymentTermOptions.map((term) => (
                              <SelectItem key={term} value={String(term)} className="text-base">
                                {term} month{term > 1 ? "s" : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Purpose */}
                <FormField
                  control={form.control}
                  name="purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Purpose</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-11 text-base">
                            <SelectValue placeholder="Select a purpose" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {loanPurposeOptions.map((purpose) => (
                            <SelectItem key={purpose} value={purpose} className="text-base">
                              {purpose}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Remarks */}
                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Remarks (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter any relevant remarks"
                          className="resize-none min-h-24 text-base"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>

            {/* Footer */}
            <SheetFooter className="pt-6 border-t mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-11 px-6 text-base"
              >
                Cancel
              </Button>

              <Button 
                type="submit" 
                disabled={form.formState.isSubmitting}
                className="h-11 px-8 text-base"
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
