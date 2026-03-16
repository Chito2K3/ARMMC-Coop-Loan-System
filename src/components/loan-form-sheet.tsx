"use client";

import * as React from "react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { collection, doc, serverTimestamp, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";

import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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
import { useFirestore, useCollection } from "@/firebase";
import { getLoanTypes, getLoanPurposes } from "@/firebase/settings-service";
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
} from "@/firebase/non-blocking-updates";
import { getNextLoanNumber } from "@/firebase/counter";
import type { LoanSerializable, LoanType, LoanPurpose } from "@/lib/types";

const paymentTermOptions = [1, 3, 4, 6, 9, 12, 18, 24];

const loanFormSchema = z.object({
  applicantName: z.string().min(2, {
    message: "Applicant name must be at least 2 characters.",
  }),
  amount: z.coerce
    .number({ message: "Please enter a valid number." })
    .positive("Loan amount must be positive."),
  paymentTerm: z.coerce
    .number()
    .refine((val) => paymentTermOptions.includes(val), {
      message: "Please select a valid payment term.",
    }),
  loanType: z.string().min(1, "Please select a loan type."),
  purpose: z.string().min(1, "Please select a purpose."),
  remarks: z.string().optional(),
  isRenewal: z.boolean().default(false),
  renewingLoanId: z.string().optional(),
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

  const [loanTypes, setLoanTypes] = React.useState<{ id: string, name: string }[]>([]);
  const [loanPurposes, setLoanPurposes] = React.useState<{ id: string, name: string }[]>([]);
  const [eligibleLoans, setEligibleLoans] = React.useState<any[]>([]);
  const [selectedOldLoan, setSelectedOldLoan] = React.useState<any>(null);

  React.useEffect(() => {
    if (open && firestore) {
      getLoanTypes(firestore).then(setLoanTypes);
      getLoanPurposes(firestore).then(setLoanPurposes);
    }
  }, [open, firestore]);

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
        isRenewal: !!loan.renewalOf,
        renewingLoanId: loan.renewalOf || "",
      }
      : {
        applicantName: "",
        amount: 0,
        paymentTerm: 6,
        loanType: "",
        purpose: "",
        remarks: "",
        isRenewal: false,
        renewingLoanId: "",
      },
  });

  const applicantName = form.watch("applicantName");
  const isRenewal = form.watch("isRenewal");
  const renewingLoanId = form.watch("renewingLoanId");
  const loanAmount = form.watch("amount");

  // Fetch active loans for the applicant to check for renewal eligibility
  React.useEffect(() => {
    const fetchApplicantLoans = async () => {
      if (!firestore || !applicantName || applicantName.length < 2 || !isRenewal) {
        setEligibleLoans([]);
        return;
      }

      const q = query(
        collection(firestore, "loans"),
        where("applicantName", "==", applicantName),
        where("status", "==", "released")
      );

      const snap = await getDocs(q);
      const loans = await Promise.all(snap.docs.map(async (loanDoc) => {
        const data = loanDoc.data();
        // Fetch payments to check eligibility
        const paymentsSnap = await getDocs(collection(firestore, "loans", loanDoc.id, "payments"));
        const payments = paymentsSnap.docs.map(d => d.data());
        const totalPaid = payments.filter(p => p.status === 'paid').length;
        const totalTerms = data.paymentTerm;
        
        let isEligible = false;
        let reason = "";

        if (totalTerms === 3) {
          isEligible = false;
          reason = "3-month terms cannot be renewed.";
        } else if (totalTerms === 9) {
          isEligible = totalPaid >= 5;
          reason = isEligible ? "" : "Must have ≥ 5 months paid.";
        } else {
          isEligible = totalPaid >= (totalTerms / 2);
          reason = isEligible ? "" : "Must have ≥ 50% paid.";
        }

        // Calculate outstanding principal
        const unpaidPrincipal = Math.round(payments
          .filter(p => p.status === 'pending')
          .reduce((acc, p) => acc + (p.amount || 0), 0) * 100) / 100;

        return {
          id: loanDoc.id,
          loanNumber: data.loanNumber,
          paymentTerm: data.paymentTerm,
          totalPaid,
          isEligible,
          reason,
          unpaidPrincipal,
        };
      }));

      setEligibleLoans(loans);
    };

    fetchApplicantLoans();
  }, [firestore, applicantName, isRenewal]);

  React.useEffect(() => {
    if (renewingLoanId) {
      const selected = eligibleLoans.find(l => l.id === renewingLoanId);
      setSelectedOldLoan(selected || null);
    } else {
      setSelectedOldLoan(null);
    }
  }, [renewingLoanId, eligibleLoans]);

  const netProceeds = React.useMemo(() => {
    if (!isRenewal || !selectedOldLoan || !loanAmount) return null;
    const calc = loanAmount - selectedOldLoan.unpaidPrincipal;
    return Math.round(calc * 100) / 100;
  }, [isRenewal, selectedOldLoan, loanAmount]);

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
        await updateDocumentNonBlocking(loanRef, {
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
          renewalOf: data.isRenewal ? data.renewingLoanId : null,
          netProceeds: data.isRenewal ? (Math.round((loanAmount - (selectedOldLoan?.unpaidPrincipal || 0)) * 100) / 100) : null,
          outstandingBalanceAtRenewal: data.isRenewal ? (Math.round((selectedOldLoan?.unpaidPrincipal || 0) * 100) / 100) : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const docRef = await addDocumentNonBlocking(
          collection(firestore, "loans"),
          newLoan
        );

        toast({
          title: "Loan Created",
          description: "The new loan application has been saved.",
        });

        if (docRef?.id) {
          router.push(`/loan/${docRef.id}`);
        }
      }

      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Error submitting loan:', error);
      toast({
        variant: "destructive",
        title: "An error occurred",
        description: error instanceof Error ? error.message : 'Failed to submit loan',
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
                <div className="space-y-4">
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

                  {/* Renewal Toggle */}
                  <FormField
                    control={form.control}
                    name="isRenewal"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Loan Renewal</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Renew an existing active loan
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {isRenewal && (
                    <div className="space-y-4 pt-2">
                       <FormField
                        control={form.control}
                        name="renewingLoanId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold text-amber-600">Select Loan to Renew</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11 border-amber-500/50">
                                  <SelectValue placeholder="Select an active loan" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {eligibleLoans.length === 0 ? (
                                  <div className="p-4 text-sm text-muted-foreground text-center">No active loans found for this applicant</div>
                                ) : (
                                  eligibleLoans.map((l) => (
                                    <SelectItem key={l.id} value={l.id} disabled={!l.isEligible}>
                                      Loan #{l.loanNumber} ({l.paymentTerm}mo) - {l.totalPaid} paid 
                                      {!l.isEligible && ` - [${l.reason}]`}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {selectedOldLoan && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">New Principal:</span>
                            <span className="font-bold">₱{loanAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Unpaid Balance to Deduct:</span>
                            <span className="font-bold text-red-500">-₱{selectedOldLoan.unpaidPrincipal.toLocaleString()}</span>
                          </div>
                          <Separator className="bg-amber-500/20" />
                          <div className="flex justify-between items-center">
                            <span className="text-base font-bold text-amber-700">Net Proceeds:</span>
                            <span className="text-xl font-black text-amber-600">
                              ₱{(Math.round((loanAmount - selectedOldLoan.unpaidPrincipal) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <p className="text-[10px] text-amber-700/70 italic text-center">
                             Borrower will receive this amount after settling the old balance.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

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
                            {loanTypes.map((type) => (
                              <SelectItem key={type.id} value={type.name} className="text-base">
                                {type.name}
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
                          {loanPurposes.map((purpose) => (
                            <SelectItem key={purpose.id} value={purpose.name} className="text-base">
                              {purpose.name}
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
