import { Firestore, collection, doc, getDoc, setDoc, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';

export type UserRole = 'admin' | 'bookkeeper' | 'payrollChecker' | 'approver' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export async function getOrCreateUser(firestore: Firestore, uid: string, email: string, name: string): Promise<UserProfile | null> {
  const userRef = doc(firestore, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      id: uid,
      email: data.email,
      name: data.name,
      role: data.role,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  }

  // Check if user exists by email
  const usersRef = collection(firestore, 'users');
  const q = query(usersRef, where('email', '==', email));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    const data = querySnapshot.docs[0].data();
    return {
      id: querySnapshot.docs[0].id,
      email: data.email,
      name: data.name,
      role: data.role,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  }

  // User not found - return null instead of creating
  return null;
}

export async function getAllUsers(firestore: Firestore): Promise<UserProfile[]> {
  const usersRef = collection(firestore, 'users');
  const usersSnap = await getDocs(usersRef);
  
  return usersSnap.docs.map(doc => ({
    id: doc.id,
    email: doc.data().email,
    name: doc.data().name,
    role: doc.data().role,
    createdAt: doc.data().createdAt?.toDate?.() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate?.() || new Date(),
  }));
}

export async function updateUserRole(firestore: Firestore, userId: string, role: UserRole): Promise<void> {
  const userRef = doc(firestore, 'users', userId);
  await updateDoc(userRef, {
    role,
    updatedAt: new Date(),
  });
}

export async function deleteUser(firestore: Firestore, userId: string): Promise<void> {
  const userRef = doc(firestore, 'users', userId);
  await deleteDoc(userRef);
}
