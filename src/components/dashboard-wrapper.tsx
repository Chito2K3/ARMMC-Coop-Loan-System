'use client';

import { DashboardClient } from './dashboard-client';
import { useApprovalPanel } from './approval-context';
import { useEffect, useState } from 'react';
import { useUser, useFirestore } from '@/firebase/provider';
import { collection, query, where, getDocs } from 'firebase/firestore';

export function DashboardWrapper() {
  const { showApprovalPanel, setShowApprovalPanel } = useApprovalPanel();
  const { user } = useUser();
  const firestore = useFirestore();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !firestore) return;

    const fetchUserRole = async () => {
      try {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('email', '==', user.email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setUserRole(querySnapshot.docs[0].data().role);
        }
      } catch (err) {
        console.error('Failed to fetch user role:', err);
      }
    };

    fetchUserRole();
  }, [user, firestore]);

  return (
    <DashboardClient 
      showApprovalPanel={showApprovalPanel} 
      onShowApprovalPanel={setShowApprovalPanel}
    />
  );
}
