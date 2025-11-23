"use client";

import * as React from "react";
import {
  Check,
  ChevronLeft,
  Circle,
  FilePenLine,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/componentsui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { updateLoan } from "@/app/actions";
import { toast } from "@/hooks/use-toast";
import type { ApprovalStatus, LoanSerializable, LoanStatus } from "@/lib/types";
import { StatusBadge } from "./status-badge";
import { LoanFormSheet } from "./loan-form-sheet";
import { AIRiskAssessment } from "./ai-risk-assessment";

export function LoanDetailView({
  initialLoan,
}: {
  initialLoan: LoanSerializable;
}) {
  const router = useRouter();
  const [loan, setLoan] = React.useState(initialLoan);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [isDenyDialogOpen, setDenyDialogOpen] = React.useState(false);
  const [denialRemarks, setDenialRemarks] = React.useState("");

  React.useEffect(() => {
    setLoan(initialLoan);
  }, [initialLoan]);

  const handleUpdate = async (
    data: Partial<Omit<LoanSerializable, "id">>
  ) => {
    setIsSubmitting(true);
    try {
      const result = await updateLoan(loan.id, data);
      if (result.success) {
        toast({
          title: "Update Successful",
          description: "The loan application has been updated.",
        });
        // We don't need to manually set state as revalidation will trigger a re-render
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: (error as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!denialRemarks) {
      toast({
        variant: "destructive",
        title: "Remarks Required",
        description: "Please provide a reason for denial.",
      });
      return;
    }
    await handleUpdate({ status: "denied", denialRemarks });
    setDenyDialogOpen(false);
    setDenialRemarks("");
  };

  const InfoItem = ({
    label,
    value,
  }: {
    label: string;
    value: React.ReactNode;
  }) => (
    <div className="flex justify-between items-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Loan #{loan.No}
          </h1>
          <p className="text-muted-foreground">
            Applicant: {loan.applicantName}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Loan Details</CardTitle>
                <CardDescription>
                  Core information about the application.
                </CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)}>
                <FilePenLine className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoItem
                label="Amount"
                value={new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "PHP",
                }).format(loan.amount)}
              />
              <InfoItem label="Salary" value={
                  <div className="flex gap-2 items-center">
                    <Input
                      type="number"
                      defaultValue={loan.salary}
                      onBlur={(e) => handleUpdate({ salary: Number(e.target.value) })}
                      className="h-8 text-right w-32"
                      disabled={isSubmitting}
                    />
                  </div>
              } />
              <InfoItem label="Status" value={<StatusBadge status={loan.status} />} />
              <InfoItem
                label="Created"
                value={format(new Date(loan.createdAt), "PP")}
              />
              <InfoItem
                label="Last Updated"
                value={format(new Date(loan.updatedAt), "PPpp")}
              />
              {loan.remarks && <InfoItem label="Remarks" value={loan.remarks} />}
              {loan.status === 'denied' && loan.denialRemarks && (
                <InfoItem label="Denial Remarks" value={<span className="text-destructive font-medium">{loan.denialRemarks}</span>} />
              )}
            </CardContent>
          </Card>
          <AIRiskAssessment loan={loan} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Approval Workflow</CardTitle>
              <CardDescription>Manage the loan's journey.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => handleUpdate({ status: "approved" })} disabled={isSubmitting || loan.status === 'approved'}>
                        <ThumbsUp className="mr-2 h-4 w-4" /> Approve
                    </Button>
                    <Button variant="destructive" onClick={() => setDenyDialogOpen(true)} disabled={isSubmitting || loan.status === 'denied'}>
                        <ThumbsDown className="mr-2 h-4 w-4" /> Deny
                    </Button>
                    <Button variant="secondary" onClick={() => handleUpdate({ status: "released" })} disabled={isSubmitting || loan.status !== 'approved'}>
                        Mark as Released
                    </Button>
                </div>
                <Separator />
                <div className="space-y-4">
                    <h4 className="font-medium">Checklists</h4>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="bookkeeperChecked">Bookkeeper Checked</Label>
                        <Button variant={loan.bookkeeperChecked ? "default" : "outline"} size="icon" onClick={() => handleUpdate({ bookkeeperChecked: !loan.bookkeeperChecked })} disabled={isSubmitting}>
                            {loan.bookkeeperChecked ? <Check /> : <X />}
                        </Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="payrollChecked">Payroll Checked</Label>
                        <Button variant={loan.payrollChecked ? "default" : "outline"} size="icon" onClick={() => handleUpdate({ payrollChecked: !loan.payrollChecked })} disabled={isSubmitting}>
                            {loan.payrollChecked ? <Check /> : <X />}
                        </Button>
                    </div>
                </div>
                <Separator />
                <div className="space-y-4">
                    <h4 className="font-medium">Approvals</h4>
                    <div className="flex items-center justify-between">
                        <Label>Approver 1</Label>
                        <Select value={loan.approvals.approver1} onValueChange={(val: ApprovalStatus) => handleUpdate({approvals: {...loan.approvals, approver1: val}})} disabled={isSubmitting}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Set status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="denied">Denied</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Approver 2</Label>
                        <Select value={loan.approvals.approver2} onValueChange={(val: ApprovalStatus) => handleUpdate({approvals: {...loan.approvals, approver2: val}})} disabled={isSubmitting}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Set status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="denied">Denied</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <LoanFormSheet
        open={isSheetOpen}
        onOpenChange={setSheetOpen}
        loan={loan}
      />
      <AlertDialog open={isDenyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny Loan Application</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide remarks for denying this loan. This will be
              visible to the team.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="denial-remarks" className="sr-only">
              Denial Remarks
            </Label>
            <Input
              id="denial-remarks"
              placeholder="e.g., Insufficient salary"
              value={denialRemarks}
              onChange={(e) => setDenialRemarks(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeny} disabled={!denialRemarks || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Denial
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
