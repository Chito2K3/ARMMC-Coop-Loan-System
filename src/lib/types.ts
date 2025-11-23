import type { Timestamp } from 'firebase/firestore';

export type LoanStatus = 'pending' | 'approved' | 'denied' | 'released';
export type ApprovalStatus = 'pending' | 'approved' | 'denied';

export interface Loan {
  id: string;
  No: number;
  applicantName: string;
  amount: number;
  salary: number;
  status: LoanStatus;
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
export type LoanWrite = Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'No'>;
