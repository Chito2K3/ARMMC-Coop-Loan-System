"use client";

import { useState } from "react";
import { Wand2, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import type { Loan } from "@/lib/types";
import { assessLoanRisk, AssessLoanRiskOutput } from "@/ai/ai-risk-assessment";

export function AIRiskAssessment({ loan }: { loan: Loan }) {
  const [assessment, setAssessment] = useState<AssessLoanRiskOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);


  const handleAssess = async () => {
    if (loan.salary <= 0) {
      alert("Please set the applicant's salary before assessing risk.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await assessLoanRisk({
        applicantName: loan.applicantName,
        amount: loan.amount,
        salary: loan.salary,
      });
      setAssessment(result);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score > 70) return "text-red-500";
    if (score > 40) return "text-amber-500";
    return "text-green-500";
  };
  
  const getRiskIcon = (score: number) => {
    if (score > 70) return <AlertTriangle className="h-4 w-4" />;
    return <ShieldCheck className="h-4 w-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          <span>AI-Powered Risk Assessment</span>
        </CardTitle>
        <CardDescription>
          Uses Google AI to generate an estimated risk score and highlight potential concerns based on the applicant's financial details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleAssess} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          Assess Risk
        </Button>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Assessment Failed</AlertTitle>
            <AlertDescription>
              {error.message || "The AI model failed to generate a risk assessment. Please try again."}
            </AlertDescription>
          </Alert>
        )}

        {assessment && (
          <Alert>
            {getRiskIcon(assessment.riskScore)}
            <AlertTitle className="flex items-center gap-2">
              Risk Score: 
              <span className={`font-bold ${getRiskColor(assessment.riskScore)}`}>
                {assessment.riskScore}/100
              </span>
            </AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              {assessment.concerns && (
                <div>
                  <h4 className="font-semibold text-foreground">Potential Concerns:</h4>
                  <p>{assessment.concerns}</p>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
