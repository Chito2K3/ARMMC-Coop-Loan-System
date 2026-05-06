import { Firestore, collection, doc, getDoc, setDoc, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';

export type UserRole = 'admin' | 'bookkeeper' | 'payrollChecker' | 'creditCommitteeMember' | 'creditCommitteeOfficer' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export async function getUser(firestore: Firestore, uid: string, email: string, name: string): Promise<UserProfile | null> {
  const userRef = doc(firestore, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    if (!data) {
      console.error('User document exists but has no data:', uid);
      return null;
    }
    return {
      id: uid,
      email: data.email || email,
      name: data.name || name,
      role: data.role || 'user',
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
  
  return usersSnap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      email: data.email,
      name: data.name,
      role: data.role,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  });
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

/**
 * Ensures a `users/{uid}` document exists for the given Firebase user.
 * 
 * If the document already exists, this is a no-op.
 * If not, it attempts to find an existing user record by email and copies the
 * role/name data to the UID-keyed document. If no email match is found, it
 * creates a minimal document with the default role.
 * 
 * This consolidates duplicate logic previously spread across:
 * - FirebaseProvider (provider.tsx)
 * - AuthGuard (auth-guard.tsx)
 * - LoanDetailView (loan-detail-view-new.tsx)
 */
export async function ensureUserDoc(
  firestore: Firestore,
  uid: string,
  email: string | null,
  displayName: string | null,
  defaultRole: UserRole = 'user'
): Promise<void> {
  const userRef = doc(firestore, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  // If user doc exists, we might still need to sync the role from an email-keyed doc
  if (userSnap.exists() && userSnap.data()?.role !== 'user') {
    console.log('User profile already has role:', userSnap.data()?.role);
    return; // Already has a non-default role, safe to return
  }

  console.log('Checking for role sync for email:', email);

  if (email) {
    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where('email', '==', email));
    const qs = await getDocs(q);

    if (!qs.empty) {
      const data = qs.docs[0].data();
      // If we found a record by email, sync its data to the UID-keyed record
      await setDoc(userRef, {
        email: data.email || email,
        name: data.name || displayName || '',
        role: data.role || defaultRole,
        createdAt: data.createdAt || new Date(),
        updatedAt: new Date(),
      }, { merge: true });
      return;
    }
  }

  // No existing record — create minimal user doc keyed by UID
  await setDoc(userRef, {
    email: email || '',
    name: displayName || '',
    role: defaultRole,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
