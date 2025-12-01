'use client';

import { useEffect, useState } from 'react';
import { useFirestore, useUser } from '@/firebase/provider';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole: 'admin' | 'user';
}

export function RoleGuard({ children, requiredRole }: RoleGuardProps) {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || isUserLoading) return;

    const fetchUserRole = async () => {
      try {
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserRole(userSnap.data().role);
        } else {
          console.warn('User document not found');
          setUserRole(null);
        }
      } catch (err) {
        console.error('Failed to fetch user role:', err);
        setUserRole(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserRole();
  }, [user, isUserLoading, firestore]);

  if (isLoading || isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requiredRole === 'admin' && userRole !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
