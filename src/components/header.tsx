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
import type { Loan } from '@/lib/types';

export function Header() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { setShowApprovalPanel, setShowSalaryInputPanel, setShowReleasePanel, setShowPenaltyPanel } = useApprovalPanel();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [penaltyCount, setPenaltyCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchUserRole = async () => {
      try {
        const userRef = doc(firestore, 'users', user.uid);
        let userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
          const usersRef = collection(firestore, 'users');
          const snapshot = await getDocs(usersRef);
          userSnap = snapshot.docs.find(doc => doc.data().email === user.email);
        }
        
        if (userSnap?.exists()) {
          setUserRole(userSnap.data().role);
          setUserName(userSnap.data().name);
        }
      } catch (err) {
        console.error('Failed to fetch user role:', err);
      }
    };

    fetchUserRole();
  }, [user, firestore]);

  const loansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'loans'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: allLoans } = useCollection<Loan>(loansQuery);

  const approvalCount = useMemo(() => {
    if (!allLoans) return 0;
    return allLoans.filter(loan => loan.status === 'pending').length;
  }, [allLoans]);

  const salaryCount = useMemo(() => {
    if (!allLoans) return 0;
    return allLoans.filter(loan => loan.status === 'pending' && (!loan.salary || loan.salary === 0)).length;
  }, [allLoans]);

  const releaseCount = useMemo(() => {
    if (!allLoans) return 0;
    return allLoans.filter(loan => loan.status === 'approved').length;
  }, [allLoans]);

  useEffect(() => {
    const fetchPenalties = async () => {
      if (!allLoans || !firestore) {
        setPenaltyCount(0);
        return;
      }

      let count = 0;
      for (const loan of allLoans) {
        if (loan.status === 'released') {
          try {
            const paymentsRef = collection(firestore, 'loans', loan.id, 'payments');
            const snapshot = await getDocs(paymentsRef);

            snapshot.docs.forEach((doc) => {
              const payment = doc.data();
              if (payment.status !== 'pending') return;
              
              const dueDate = payment.dueDate?.toDate?.() || new Date(payment.dueDate);
              
              if (!isNaN(dueDate.getTime())) {
                const today = new Date();
                const isOverdue = differenceInDays(today, dueDate) > 3;
                const penalty = isOverdue && !payment.penaltyWaived && !payment.penaltyDenied ? 500 : 0;

                if (penalty > 0) {
                  count++;
                }
              }
            });
          } catch (err) {
            console.error(`Error fetching payments for loan ${loan.id}:`, err);
          }
        }
      }

      setPenaltyCount(count);
    };

    fetchPenalties();
  }, [allLoans, firestore]);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 flex items-center justify-center border-b border-border">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">{userName || 'User'}</h2>
          <p className="text-base text-muted-foreground capitalize mt-1">{userRole || 'Loading...'}</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 space-y-2">
        <Link href="/" onClick={() => setIsOpen(false)} className="w-full">
          <Button variant="ghost" className="w-full justify-start">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </Link>
        <Link href="/reports" onClick={() => setIsOpen(false)} className="w-full">
          <Button variant="ghost" className="w-full justify-start">
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports
          </Button>
        </Link>
        {userRole === 'admin' && (
          <>
            <Link href="/admin" onClick={() => setIsOpen(false)} className="w-full">
              <Button variant="ghost" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Admin
              </Button>
            </Link>
            <Link href="/admin/settings" onClick={() => setIsOpen(false)} className="w-full">
              <Button variant="ghost" className="w-full justify-start">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
          </>
        )}
        {(userRole === 'approver' || userRole === 'admin') && (
          <Button variant="outline" className="w-full justify-start" onClick={() => { setIsOpen(false); setShowApprovalPanel(true); }}>
            For Approval {approvalCount > 0 && <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">{approvalCount}</span>}
          </Button>
        )}
        {(userRole === 'payrollChecker' || userRole === 'admin') && (
          <Button variant="outline" className="w-full justify-start" onClick={() => { setIsOpen(false); setShowSalaryInputPanel(true); }}>
            Input Salary {salaryCount > 0 && <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">{salaryCount}</span>}
          </Button>
        )}
        {(userRole === 'bookkeeper' || userRole === 'admin') && (
          <Button variant="outline" className="w-full justify-start" onClick={() => { setIsOpen(false); setShowReleasePanel(true); }}>
            For Releasing {releaseCount > 0 && <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">{releaseCount}</span>}
          </Button>
        )}
        {(userRole === 'approver' || userRole === 'admin') && (
          <Button variant="outline" className="w-full justify-start" onClick={() => { setIsOpen(false); setShowPenaltyPanel(true); }}>
            Waive Penalty {penaltyCount > 0 && <span className="ml-auto bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5">{penaltyCount}</span>}
          </Button>
        )}
      </div>

      <div className="p-6 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await auth.signOut();
            } catch (err) {
              console.error('Logout failed:', err);
            }
          }}
          className="w-full"
        >
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-full items-center px-4 md:px-6 gap-4">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="lg:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <SidebarContent />
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Image src="/logo.png" alt="ARMMC Logo" width={40} height={40} className="rounded-full" />
            <span className="hidden sm:inline-block text-lg md:text-2xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              ARMMC Loan Manager
            </span>
          </Link>
        </div>
        <div className="flex items-center justify-end space-x-4">
          {userRole === 'admin' && (
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
