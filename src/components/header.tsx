'use client';

import Link from 'next/link';
import { Settings, Menu, BarChart3, Home } from 'lucide-react';
import Image from 'next/image';
import { Button } from './ui/button';
import { useAuth, useUser, useFirestore } from '@/firebase/provider';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState, useMemo } from 'react';
import { doc, getDoc, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useCollection, useMemoFirebase } from '@/firebase';
import { useApprovalPanel } from './approval-context';
import { differenceInDays } from 'date-fns';
import { getPenaltySettings } from '@/firebase/penalty-service';
import type { Loan } from '@/lib/types';

interface HeaderProps {
  isSidebarExpanded: boolean;
  onToggleSidebar: () => void;
}

export function Header({ isSidebarExpanded, onToggleSidebar }: HeaderProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchUserRole = async () => {
      try {
        const userRef = doc(firestore, 'users', user.uid);
        let userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          const usersRef = collection(firestore, 'users');
          const snapshot = await getDocs(usersRef);
          const foundDoc = snapshot.docs.find(doc => doc.data().email === user.email);
          if (foundDoc) {
            userSnap = foundDoc as any;
          }
        }

        if (userSnap?.exists()) {
          setUserRole(userSnap.data()?.role);
          setUserName(userSnap.data()?.name);
        }
      } catch (err) {
        console.error('Failed to fetch user role:', err);
      }
    };

    fetchUserRole();
  }, [user, firestore]);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#E2E8F0] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="flex h-16 items-center px-4 md:px-6 gap-4">
        <div className="flex items-center gap-4 flex-1">
          <Link href="/" className="flex items-center space-x-2 mr-2">
            <Image src="/armmc-logo.jpg" alt="ARMMC Logo" width={36} height={36} className="rounded-full object-contain bg-white" />
          </Link>
          
          <div className="h-4 w-[1px] bg-[#E2E8F0] mx-1" />
          
          <nav className="flex items-center text-sm font-medium">
            <Link 
              href="/" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
            <span className="mx-2 text-muted-foreground/50">/</span>
            <span className="text-foreground">Loans</span>
          </nav>
        </div>

        <div className="flex items-center justify-end gap-2">
          {userRole === 'admin' && (
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="h-9">
                <Settings className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
          )}
          <div className="h-8 w-[1px] bg-[#E2E8F0] mx-2" />
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-medium">{userName || 'User'}</span>
              <span className="text-[10px] text-muted-foreground capitalize">{userRole?.replace(/([A-Z])/g, ' $1').trim()}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
