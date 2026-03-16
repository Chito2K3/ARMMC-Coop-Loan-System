import { Firestore, collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';

export async function initializeSettings(firestore: Firestore) {
  const loanTypes = ['Regular', 'Emergency', 'Others'];
  const loanPurposes = [
    'Business Capital',
    'Bills Payment',
    'Tuition',
    'House Renovation',
    'Medical Expenses',
    'Travel Expenses'
  ];

  // Initialize Loan Types
  const typesRef = collection(firestore, 'loanTypes');
  const typesSnap = await getDocs(typesRef);
  if (typesSnap.empty) {
    for (const type of loanTypes) {
      await setDoc(doc(typesRef, type.toLowerCase().replace(/\s+/g, '-')), {
        name: type,
        createdAt: new Date(),
      });
    }
  }

  // Initialize Loan Purposes
  const purposesRef = collection(firestore, 'loanPurposes');
  const purposesSnap = await getDocs(purposesRef);
  if (purposesSnap.empty) {
    for (const purpose of loanPurposes) {
      await setDoc(doc(purposesRef, purpose.toLowerCase().replace(/\s+/g, '-')), {
        name: purpose,
        createdAt: new Date(),
      });
    }
  }
}

export async function getLoanTypes(firestore: Firestore) {
  const typesRef = collection(firestore, 'loanTypes');
  const typesSnap = await getDocs(typesRef);
  return typesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as { id: string, name: string }));
}

export async function addLoanType(firestore: Firestore, name: string) {
  const typesRef = collection(firestore, 'loanTypes');
  const id = name.toLowerCase().replace(/\s+/g, '-');
  await setDoc(doc(typesRef, id), { name, createdAt: new Date() });
}

export async function deleteLoanType(firestore: Firestore, id: string) {
  const typesRef = collection(firestore, 'loanTypes');
  await deleteDoc(doc(typesRef, id));
}

export async function getLoanPurposes(firestore: Firestore) {
  const purposesRef = collection(firestore, 'loanPurposes');
  const purposesSnap = await getDocs(purposesRef);
  return purposesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as { id: string, name: string }));
}

export async function addLoanPurpose(firestore: Firestore, name: string) {
  const purposesRef = collection(firestore, 'loanPurposes');
  const id = name.toLowerCase().replace(/\s+/g, '-');
  await setDoc(doc(purposesRef, id), { name, createdAt: new Date() });
}

export async function deleteLoanPurpose(firestore: Firestore, id: string) {
  const purposesRef = collection(firestore, 'loanPurposes');
  await deleteDoc(doc(purposesRef, id));
}


