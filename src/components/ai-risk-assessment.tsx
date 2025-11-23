"use client";

import { useState } from "react";
import { useFlow } from "@genkit-ai/next/client";
import { Wand2, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { z } from "zod";
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
import type { LoanSerializable } from "@/lib/types";

// NOTE: The `loanRiskAssessor` flow is assumed to exist in `/src/ai/flows/`
// as per the project instructions.

const inputSchema = z.object({
  applicantName: z.string(),
  loanAmount: z.number(),
  salary: z.number(),
});

const outputSchema = z.object({
  riskScore: z.number(),
  assessment: z.string(),
  concerns: z.array(z.string()),
});

export function AIRiskAssessment({ loan }: { loan: LoanSerializable }) {
  const [run, { data, loading, error }] = useFlow<
    z.infer<typeof inputSchema>,
    z.infer<typeof outputSchema>
  >("loanRiskAssessor");

  const handleAssess = () => {
    if (loan.salary <= 0) {
      alert("Please set the applicant's salary before assessing risk.");
      return;
    }
    run({
      applicantName: loan.applicantName,
      loanAmount: loan.amount,
      salary: loan.salary,
    });
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
          Generate an estimated risk score and potential concerns.
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
              The AI model failed to generate a risk assessment. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {data && (
          <Alert>
            {getRiskIcon(data.riskScore)}
            <AlertTitle className="flex items-center gap-2">
              Risk Score: 
              <span className={`font-bold ${getRiskColor(data.riskScore)}`}>
                {data.riskScore}/100
              </span>
            </AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
              <p className="font-medium">{data.assessment}</p>
              {data.concerns.length > 0 && (
                <div>
                  <h4 className="font-semibold text-foreground">Potential Concerns:</h4>
                  <ul className="list-disc pl-5 space-y-1 mt-1">
                    {data.concerns.map((concern, index) => (
                      <li key={index}>{concern}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
