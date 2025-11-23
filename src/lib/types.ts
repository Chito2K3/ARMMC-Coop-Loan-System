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
  approvals: {
    approver1: ApprovalStatus;
    approver2: ApprovalStatus;
  };
  denialRemarks?: string;
  remarks?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type LoanSerializable = Omit<Loan, 'createdAt' | 'updatedAt'> & {
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
};
