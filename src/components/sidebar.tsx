'use client';

import { useUser } from '@/firebase/provider';
import { useAuth } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';

export function Sidebar() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (user && firestore) {
      const fetchUserData = async () => {
        try {
          const usersRef = collection(firestore, 'users');
          const q = query(usersRef, where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            setUserName(userData.name);
            setUserRole(userData.role);
          }
        } catch (err) {
          console.error('Failed to fetch user data:', err);
        }
      };
      fetchUserData();
    }
  }, [user, firestore]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className="hidden lg:flex w-64 bg-card border-r border-border h-screen flex-col fixed left-0 top-0 pt-14">
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">{userName || 'User'}</h2>
          <p className="text-base text-muted-foreground capitalize mt-1">{userRole || 'Loading...'}</p>
        </div>
      </div>

      <div className="flex-1"></div>

      <div className="p-6 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="w-full"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
