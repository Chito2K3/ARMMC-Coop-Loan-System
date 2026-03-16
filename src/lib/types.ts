import type { Timestamp } from 'firebase/firestore';

export type LoanStatus = 'pending' | 'approved' | 'denied' | 'released' | 'fully-paid';
export type ApprovalStatus = 'pending' | 'approved' | 'denied';
export type LoanType = string;
export type LoanPurpose = string;

export interface Loan {
  id: string;
  loanNumber: number;
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
  historical_shortfall_bucket?: number;
  final_surcharge_total?: number;
  final_surcharge_paid?: number;
  final_surcharge_date?: Timestamp | Date;
  reviews?: Record<string, { role: string; status: 'approved' | 'denied'; name: string; timestamp: any }>;
  renewalOf?: string;
  netProceeds?: number;
  outstandingBalanceAtRenewal?: number;
}

export type PaymentStatus = 'pending' | 'paid';

export interface Payment {
  id: string;
  loanId: string;
  paymentNumber: number;
  dueDate: Timestamp | Date;
  amount: number;
  paymentDate?: Timestamp | Date;
  actualAmountPaid?: number;
  status: PaymentStatus;
  penalty: number;
  shortfall_recorded?: number;
  monthly_penalty?: number;
  remarks?: string;
}

export interface PenaltySettings {
  penaltyAmount: number;
  gracePeriodDays: number;
  updatedAt: Timestamp | Date;
  updatedBy: string;
}

// This type is for data coming from Firestore that needs to be serialized
// for Next.js server components or client components.
export type LoanSerializable = Omit<Loan, 'createdAt' | 'updatedAt' | 'releasedAt'> & {
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  releasedAt?: string; // ISO string
  final_surcharge_date?: string; // ISO string
};

export type PaymentSerializable = Omit<Payment, 'dueDate' | 'paymentDate'> & {
  dueDate: string;
  paymentDate?: string;
};


// This is the shape of the data when we create or update a loan document
export type LoanWrite = Omit<Loan, 'id' | 'createdAt' | 'updatedAt' | 'releasedAt'>;
export type PaymentWrite = Omit<Payment, 'id'>;
