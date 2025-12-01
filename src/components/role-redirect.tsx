'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase/provider';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export function RoleRedirect() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      setIsChecking(false);
      return;
    }

    const checkRoleAndRedirect = async () => {
      try {
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const role = userSnap.data().role;
          if (role === 'admin') {
            router.push('/admin');
          } else {
            router.push('/');
          }
        } else {
          router.push('/');
        }
      } catch (err) {
        console.error('Failed to check role:', err);
        router.push('/');
      } finally {
        setIsChecking(false);
      }
    };

    checkRoleAndRedirect();
  }, [user, isUserLoading, firestore, router]);

  if (isUserLoading || isChecking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return null;
}
