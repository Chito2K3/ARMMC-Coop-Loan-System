'use server';

/**
 * @fileOverview An AI-powered risk assessment tool for loan applications.
 *
 * - assessLoanRisk - A function that generates a risk score and suggests concerns for loan approval.
 * - AssessLoanRiskInput - The input type for the assessLoanRisk function.
 * - AssessLoanRiskOutput - The return type for the assessLoanRisk function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AssessLoanRiskInputSchema = z.object({
  applicantName: z.string().describe('The name of the loan applicant.'),
  amount: z.number().describe('The loan amount requested by the applicant.'),
  salary: z.number().describe('The applicant\'s salary.'),
  denialHistory: z.string().optional().describe('The applicant\'s loan denial history, if any.'),
});
export type AssessLoanRiskInput = z.infer<typeof AssessLoanRiskInputSchema>;

const AssessLoanRiskOutputSchema = z.object({
  riskScore: z.number().describe('An estimated risk score for the applicant (0-100).'),
  concerns: z.string().describe('Relevant concerns related to the loan approval, if any.'),
});
export type AssessLoanRiskOutput = z.infer<typeof AssessLoanRiskOutputSchema>;

export async function assessLoanRisk(input: AssessLoanRiskInput): Promise<AssessLoanRiskOutput> {
  return assessLoanRiskFlow(input);
}

const prompt = ai.definePrompt({
  name: 'assessLoanRiskPrompt',
  input: {schema: AssessLoanRiskInputSchema},
  output: {schema: AssessLoanRiskOutputSchema},
  prompt: `You are an AI assistant specializing in risk assessment for loan applications.

  Generate a risk score (0-100) for the applicant based on the following information:
  - Applicant Name: {{{applicantName}}}
  - Loan Amount: {{{amount}}}
  - Salary: {{{salary}}}
  - Denial History: {{{denialHistory}}}

  Also, suggest any relevant concerns related to the loan approval based on the provided information.

  Output the risk score and concerns in JSON format.`,
});

const assessLoanRiskFlow = ai.defineFlow(
  {
    name: 'assessLoanRiskFlow',
    inputSchema: AssessLoanRiskInputSchema,
    outputSchema: AssessLoanRiskOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
