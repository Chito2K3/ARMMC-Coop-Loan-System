'use client';

import { useUser } from '@/firebase/provider';
import { useAuth } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { LogOut, BarChart3, Home, Settings } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useCollection, useMemoFirebase } from '@/firebase';
import { useApprovalPanel } from './approval-context';
import Link from 'next/link';
import { differenceInDays } from 'date-fns';
import { getPenaltySettings } from '@/firebase/penalty-service';
import type { Loan } from '@/lib/types';

export function Sidebar() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { setShowApprovalPanel, setShowSalaryInputPanel, setShowReleasePanel, setShowPenaltyPanel } = useApprovalPanel();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [penaltyCount, setPenaltyCount] = useState(0);

  useEffect(() => {
    if (user && firestore) {
      const fetchUserData = async () => {
        try {
          const usersRef = collection(firestore, 'users');
          const snapshot = await getDocs(usersRef);
          const userData = snapshot.docs.find(doc => doc.data().email === user.email)?.data();
          if (userData) {
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



  // ...

  useEffect(() => {
    const fetchPenalties = async () => {
      if (!allLoans || !firestore) {
        setPenaltyCount(0);
        return;
      }

      let gracePeriod = 3;
      try {
        const settings = await getPenaltySettings(firestore);
        gracePeriod = settings.gracePeriodDays;
      } catch (e) {
        console.error('Failed to load penalty settings:', e);
      }

      let count = 0;
      for (const loan of allLoans) {
        if (loan.status === 'released') {
          try {
            const paymentsRef = collection(firestore, 'loans', loan.id, 'payments');
            const snapshot = await getDocs(paymentsRef);

            snapshot.docs.forEach((doc) => {
              const payment = doc.data();
              // Logic check
              const dueDate = payment.dueDate?.toDate?.() || new Date(payment.dueDate);

              if (!isNaN(dueDate.getTime())) {
                const today = new Date();
                let isOverdue = false;

                if (payment.status === 'paid' && payment.paymentDate) {
                  const paymentDate = payment.paymentDate?.toDate?.() || new Date(payment.paymentDate);
                  isOverdue = differenceInDays(paymentDate, dueDate) > gracePeriod;
                } else if (payment.status === 'pending') {
                  isOverdue = differenceInDays(today, dueDate) > gracePeriod;
                }

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

      <div className="flex-1 px-4 py-6 space-y-2">
        {userRole === 'admin' && (
          <Link href="/admin" className="w-full block">
            <Button variant="ghost" className="w-full justify-start">
              <Home className="h-4 w-4 mr-2" />
              Admin Dashboard
            </Button>
          </Link>
        )}
        <Link href="/" className="w-full block">
          <Button variant="ghost" className="w-full justify-start">
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </Link>
        <Link href="/reports" className="w-full block">
          <Button variant="ghost" className="w-full justify-start">
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports
          </Button>
        </Link>
        {userRole === 'admin' && (
          <Link href="/admin/settings" className="w-full block">
            <Button variant="ghost" className="w-full justify-start">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
        )}
        {(userRole === 'approver' || userRole === 'admin') && (
          <Button variant="outline" className="w-full justify-start" onClick={() => setShowApprovalPanel(true)}>
            For Approval {approvalCount > 0 && <span className="ml-auto bg-red-600 text-white text-xs rounded-full px-2 py-0.5">{approvalCount}</span>}
          </Button>
        )}
        {(userRole === 'payrollChecker' || userRole === 'admin') && (
          <Button variant="outline" className="w-full justify-start" onClick={() => setShowSalaryInputPanel(true)}>
            Input Salary {salaryCount > 0 && <span className="ml-auto bg-red-600 text-white text-xs rounded-full px-2 py-0.5">{salaryCount}</span>}
          </Button>
        )}
        {(userRole === 'bookkeeper' || userRole === 'admin') && (
          <Button variant="outline" className="w-full justify-start" onClick={() => setShowReleasePanel(true)}>
            For Releasing {releaseCount > 0 && <span className="ml-auto bg-red-600 text-white text-xs rounded-full px-2 py-0.5">{releaseCount}</span>}
          </Button>
        )}
        {(userRole === 'approver' || userRole === 'admin') && (
          <Button variant="outline" className="w-full justify-start" onClick={() => setShowPenaltyPanel(true)}>
            Waive Penalty {penaltyCount > 0 && <span className="ml-auto bg-red-600 text-white text-xs rounded-full px-2 py-0.5">{penaltyCount}</span>}
          </Button>
        )}
      </div>

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
