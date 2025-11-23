import type { Timestamp } from 'firebase/firestore';

export type LoanStatus = 'pending' | 'approved' | 'denied' | 'released' | 'fully-paid';
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
  releasedAt?: Timestamp | Date;
}

export type PaymentStatus = 'pending' | 'paid';

export interface Payment {
  id: string;
  loanId: string;
  paymentNumber: number;
  dueDate: Timestamp | Date;
  amount: number;
  paymentDate?: Timestamp | Date;
  status: PaymentStatus;
  penalty: number;
  penaltyWaived: boolean;
}

// This type is for data coming from Firestore that needs to be serialized
// for Next.js server components or client components.
export type LoanSerializable = Omit<Loan, 'createdAt' | 'updatedAt' | 'releasedAt'> & {
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  releasedAt?: string; // ISO string
};

export type PaymentSerializable = Omit<Payment, 'dueDate' | 'paymentDate'> & {
  dueDate: string;
  paymentDate?: string;
};


// This is the shape of the data when we create or update a loan document
export type LoanWrite = Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'releasedAt'>;
export type PaymentWrite = Omit<Payment, 'id'>;
