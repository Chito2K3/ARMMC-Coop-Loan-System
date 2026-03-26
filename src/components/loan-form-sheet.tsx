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
import { cn } from "@/lib/utils";

const paymentTermOptions = [1, 3, 4, 6, 9, 12, 18, 24];

const loanFormSchema = z.object({
  applicantName: z.string().min(2, {
    message: "Applicant name must be at least 2 characters.",
  }),
  amount: z.coerce
    .number({ required_error: "Amount is required", invalid_type_error: "Amount must be a number" })
    .positive("Loan amount must be greater than 0."),
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

  const [loanTypes, setLoanTypes] = React.useState<{ id: string; name: string }[]>([]);
  const [loanPurposes, setLoanPurposes] = React.useState<{ id: string; name: string }[]>([]);
  const [eligibleLoans, setEligibleLoans] = React.useState<any[]>([]);
  const [selectedOldLoan, setSelectedOldLoan] = React.useState<any>(null);
  const [currentStep, setCurrentStep] = React.useState(1);

  React.useEffect(() => {
    if (open && firestore) {
      getLoanTypes(firestore).then(setLoanTypes);
      getLoanPurposes(firestore).then(setLoanPurposes);
    } else {
      setCurrentStep(1);
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

  React.useEffect(() => {
    const fetchApplicantLoans = async () => {
      if (!firestore || !applicantName || applicantName.length < 2 || !isRenewal) {
        setEligibleLoans([]);
        return;
      }

      const q = query(
        collection(firestore, "loans"),
        where("applicantName", "==", applicantName)
      );

      const snap = await getDocs(q);
      const loans = await Promise.all(
        snap.docs
          .filter(doc => doc.data().status === "released")
          .map(async (loanDoc) => {
          const data = loanDoc.data();
          const paymentsSnap = await getDocs(collection(firestore, "loans", loanDoc.id, "payments"));
          const payments = paymentsSnap.docs.map((d) => d.data());
          const totalPaid = payments.filter((p) => p.status === "paid").length;
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
            isEligible = totalPaid >= totalTerms / 2;
            reason = isEligible ? "" : "Must have ≥ 50% paid.";
          }

          const unpaidPrincipal = Math.round(
            payments
              .filter((p) => p.status === "pending")
              .reduce((acc, p) => acc + (p.amount || 0), 0) * 100
          ) / 100;

          return {
            id: loanDoc.id,
            loanNumber: data.loanNumber,
            paymentTerm: data.paymentTerm,
            totalPaid,
            isEligible,
            reason,
            unpaidPrincipal,
          };
        })
      );

      setEligibleLoans(loans);
    };

    fetchApplicantLoans();
  }, [firestore, applicantName, isRenewal]);

  React.useEffect(() => {
    if (renewingLoanId) {
      const selected = eligibleLoans.find((l) => l.id === renewingLoanId);
      setSelectedOldLoan(selected || null);
    } else {
      setSelectedOldLoan(null);
    }
  }, [renewingLoanId, eligibleLoans]);

  async function onSubmit(data: LoanFormValues) {
    if (!firestore) return;

    try {
      if (isEditMode && loan) {
        const loanRef = doc(firestore, "loans", loan.id);
        await updateDocumentNonBlocking(loanRef, {
          ...data,
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Update In Progress" });
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
          netProceeds: data.isRenewal ? Math.round((loanAmount - (selectedOldLoan?.unpaidPrincipal || 0)) * 100) / 100 : null,
          outstandingBalanceAtRenewal: data.isRenewal ? Math.round((selectedOldLoan?.unpaidPrincipal || 0) * 100) / 100 : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const docRef = await addDocumentNonBlocking(collection(firestore, "loans"), newLoan);
        toast({ title: "Loan Created" });
        if (docRef?.id) router.push(`/loan/${docRef.id}`);
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error submitting loan:", error);
    }
  }

  const steps = [
    { title: "Account Details", description: "Applicant information" },
    { title: "Loan Terms", description: "Pricing & duration" },
    { title: "Review", description: "Final confirmation" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-[66vw] p-0 flex flex-row overflow-hidden bg-white border-r">
        {/* Left Side: Step Progress */}
        <div className="w-1/4 bg-[#FAFAFA] border-r flex flex-col p-12">
          <div className="mb-12">
            <h2 className="text-xl font-bold tracking-tight text-[#1A1A1A]">New Application</h2>
            <p className="text-xs text-muted-foreground mt-1 uppercase tracking-widest font-semibold">Process steps</p>
          </div>
          
          <div className="space-y-8 relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-[#E2E8F0]" />
            {steps.map((step, idx) => (
              <div key={idx} className="flex gap-4 relative z-10">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                  currentStep > idx + 1 ? "bg-green-500 text-white" : 
                  currentStep === idx + 1 ? "bg-primary text-white scale-110 shadow-lg" : 
                  "bg-white border-2 border-[#E2E8F0] text-muted-foreground"
                )}>
                  {currentStep > idx + 1 ? "✓" : idx + 1}
                </div>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-sm font-bold transition-colors",
                    currentStep === idx + 1 ? "text-primary" : "text-muted-foreground"
                  )}>{step.title}</span>
                  <span className="text-[10px] text-muted-foreground/60">{step.description}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto">
             <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                <p className="text-[10px] uppercase font-black text-primary/40 tracking-tighter">Draft Mode</p>
                <p className="text-xs text-primary/80 leading-relaxed mt-1">Changes are saved to the secure cooperative ledger upon submission.</p>
             </div>
          </div>
        </div>

        {/* Right Side: Form Area */}
        <div className="flex-1 flex flex-col">
          <SheetHeader className="p-12 pb-6 flex flex-row items-end justify-between space-y-0">
             <div>
                <SheetTitle className="text-3xl font-black text-[#1A1A1A] leading-none">
                  {steps[currentStep-1].title}
                </SheetTitle>
                <SheetDescription className="text-base mt-2">
                  Please provide the necessary details for this stage.
                </SheetDescription>
             </div>
             <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">
                Close
             </Button>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 px-12">
                <div className="py-6 max-w-2xl space-y-10">
                  {currentStep === 1 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <FormField
                        control={form.control}
                        name="applicantName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Full Name of Borrower</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter full name" 
                                className="h-14 text-xl border-[#E2E8F0] shadow-none bg-[#FAFAFA]/50 focus:bg-white transition-all flex-1" 
                                {...field} 
                                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="bg-[#FAFAFA]/50 border border-[#E2E8F0] rounded-2xl p-6 space-y-4">
                        <FormField
                          control={form.control}
                          name="isRenewal"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0">
                              <div className="space-y-1">
                                <FormLabel className="text-base font-bold text-[#1A1A1A]">Loan Renewal</FormLabel>
                                <p className="text-sm text-muted-foreground">
                                  Renew an existing active loan
                                </p>
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
                          <div className="pt-4 border-t border-[#E2E8F0] animate-in slide-in-from-top-2">
                            <FormField
                              control={form.control}
                              name="renewingLoanId"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Select Loan to Renew</FormLabel>
                                  {eligibleLoans.length === 0 ? (
                                    <div className="text-sm text-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-200">
                                      {applicantName.length < 2 
                                        ? "Please enter the applicant's name first."
                                        : "No active loans found for this applicant."}
                                    </div>
                                  ) : (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                      <FormControl>
                                        <SelectTrigger className="h-14 bg-white border-[#E2E8F0] shadow-none">
                                          <SelectValue placeholder="Select an active loan" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {eligibleLoans.map((loan) => (
                                          <SelectItem 
                                            key={loan.id} 
                                            value={loan.id}
                                            disabled={!loan.isEligible}
                                          >
                                            <div className="flex flex-col py-1">
                                              <span className="font-medium">
                                                Loan #{loan.loanNumber} 
                                                {!loan.isEligible && " (Not Eligible)"}
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                {loan.totalPaid} / {loan.paymentTerm} months paid
                                                {!loan.isEligible && ` - ${loan.reason}`}
                                              </span>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            {selectedOldLoan && (
                              <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/10 flex justify-between items-center">
                                <span className="text-sm font-medium text-primary">Outstanding Principal</span>
                                <span className="text-lg font-black text-primary">
                                  ₱{selectedOldLoan.unpaidPrincipal.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <FormField
                        control={form.control}
                        name="loanType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Service / Loan Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-14 text-lg border-[#E2E8F0] shadow-none">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {loanTypes.map((t) => (
                                  <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
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
                            <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Intended Purpose</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-14 text-lg border-[#E2E8F0] shadow-none">
                                  <SelectValue placeholder="Select purpose" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {loanPurposes.map((p) => (
                                  <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Requested Principal Amount</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">₱</span>
                                <Input 
                                  type="number" 
                                  className="pl-12 h-20 text-4xl font-black border-[#E2E8F0] shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                  {...field} 
                                  onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="paymentTerm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Amortization Period</FormLabel>
                            <div className="grid grid-cols-4 gap-2">
                              {paymentTermOptions.map((term) => (
                                <button
                                  key={term}
                                  type="button"
                                  onClick={() => field.onChange(term)}
                                  className={cn(
                                    "h-14 rounded-xl border-2 font-bold transition-all",
                                    field.value === term 
                                      ? "border-primary bg-primary/5 text-primary" 
                                      : "border-[#E2E8F0] text-muted-foreground hover:border-primary/30"
                                  )}
                                >
                                  {term} mo
                                </button>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                       <div className="bg-[#FAFAFA] border rounded-2xl p-8 space-y-6">
                          <div className="flex justify-between items-center">
                             <span className="text-muted-foreground">Applicant</span>
                             <span className="font-bold text-lg">{applicantName}</span>
                          </div>
                          <div className="flex justify-between items-center">
                             <span className="text-muted-foreground">Amount</span>
                             <span className="font-black text-2xl text-primary">₱{Number(loanAmount).toLocaleString()}</span>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                             <div className="bg-white p-4 rounded-xl border">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Term</p>
                                <p className="text-lg font-bold">{form.getValues("paymentTerm")} Months</p>
                             </div>
                             <div className="bg-white p-4 rounded-xl border">
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Type</p>
                                <p className="text-lg font-bold truncate">{form.getValues("loanType")}</p>
                             </div>
                          </div>
                       </div>

                       <FormField
                        control={form.control}
                        name="remarks"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Official Remarks</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Add context for the credit committee..." className="min-h-32 border-[#E2E8F0] shadow-none bg-[#FAFAFA]/50" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="p-12 pt-6 border-t bg-white flex justify-between items-center">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : onOpenChange(false)}
                  className="h-14 px-8 text-base font-bold"
                >
                  {currentStep === 1 ? "Cancel" : "Back"}
                </Button>

                <div className="flex gap-4">
                  {currentStep < 3 ? (
                    <Button
                      type="button"
                      onClick={async () => {
                        // Validate current step before proceeding
                        let fieldsToValidate: any = [];
                        if (currentStep === 1) fieldsToValidate = ['applicantName', 'loanType', 'purpose', 'isRenewal', 'renewingLoanId'];
                        if (currentStep === 2) fieldsToValidate = ['amount', 'paymentTerm'];
                        
                        const isValid = await form.trigger(fieldsToValidate);
                        if (isValid) setCurrentStep(currentStep + 1);
                      }}
                      className="h-14 px-12 text-base font-bold"
                      disabled={currentStep === 1 && !applicantName}
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button type="submit" disabled={form.formState.isSubmitting} className="h-14 px-12 text-base font-bold shadow-xl shadow-primary/20">
                      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Application
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
