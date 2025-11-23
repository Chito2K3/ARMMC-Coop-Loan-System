"use server";

import { revalidatePath } from "next/cache";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  Query,
  DocumentData,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Loan, LoanSerializable, LoanStatus, ApprovalStatus } from "@/lib/types";

function serializeLoan(doc: DocumentData): LoanSerializable {
  const data = doc.data() as Loan;
  return {
    ...data,
    id: doc.id,
    createdAt: data.createdAt.toDate().toISOString(),
    updatedAt: data.updatedAt.toDate().toISOString(),
  };
}

export async function getLoans({
  status,
  sortBy = "createdAt",
  sortDirection = "desc",
}: {
  status?: LoanStatus;
  sortBy?: "createdAt" | "updatedAt";
  sortDirection?: "asc" | "desc";
}): Promise<LoanSerializable[]> {
  try {
    const loansCollection = collection(db, "loans");
    let q: Query<DocumentData, DocumentData> = query(
      loansCollection,
      orderBy(sortBy, sortDirection)
    );

    if (status) {
      q = query(q, where("status", "==", status));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(serializeLoan);
  } catch (error) {
    console.error("Error fetching loans:", error);
    return [];
  }
}

export async function getLoanById(id: string): Promise<LoanSerializable | null> {
  try {
    const docRef = doc(db, "loans", id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return serializeLoan(docSnap);
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching loan by ID:", error);
    return null;
  }
}

async function getNextLoanNumber(): Promise<number> {
    const coll = collection(db, 'loans');
    const snapshot = await getCountFromServer(coll);
    return snapshot.data().count + 1;
}

export async function createLoan(data: { applicantName: string; amount: number; remarks?: string }) {
  try {
    const nextLoanNumber = await getNextLoanNumber();
    await addDoc(collection(db, "loans"), {
      applicantName: data.applicantName,
      amount: data.amount,
      remarks: data.remarks || "",
      No: nextLoanNumber,
      salary: 0,
      status: "pending",
      bookkeeperChecked: false,
      payrollChecked: false,
      approvals: {
        approver1: "pending",
        approver2: "pending",
      },
      denialRemarks: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    revalidatePath("/");
    return { success: true, message: "Loan application created successfully." };
  } catch (error) {
    console.error("Error creating loan:", error);
    return { success: false, message: "Failed to create loan application." };
  }
}

export async function updateLoan(id: string, data: Partial<Omit<Loan, 'id' | 'createdAt' | 'updatedAt'>>) {
  try {
    const loanRef = doc(db, "loans", id);
    await updateDoc(loanRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });

    revalidatePath("/");
    revalidatePath(`/loan/${id}`);
    return { success: true, message: "Loan updated successfully." };
  } catch (error) {
    console.error("Error updating loan:", error);
    return { success: false, message: "Failed to update loan." };
  }
}
