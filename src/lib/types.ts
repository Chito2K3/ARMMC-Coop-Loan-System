import type { Timestamp } from 'firebase/firestore';

export type LoanStatus = 'pending' | 'approved' | 'denied' | 'released';
export type ApprovalStatus = 'pending' | 'approved' | 'denied';
export type LoanType = 'Cash Advance' | 'Multi-Purpose' | 'Emergency';
export type LoanPurpose =
  | 'Business Capital'
  | 'Bills Payment'
  | 'Tuition Fee'
  | 'House Renovation'
  | 'Medical Expenses'
  | 'Travel Expenses';

export interface Loan {
  id: string;
  applicantName: string;
  amount: number;
  salary: number;
  paymentTerm: number; // in months
  status: LoanStatus;
  loanType: LoanType;
  purpose: LoanPurpose;
  bookkeeperChecked: boolean;
  payrollChecked: boolean;
  denialRemarks?: string;
  remarks?: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

// This type is for data coming from Firestore that needs to be serialized
// for Next.js server components or client components.
export type LoanSerializable = Omit<Loan, 'createdAt' | 'updatedAt'> & {
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
};

// This is the shape of the data when we create or update a loan document
export type LoanWrite = Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>;