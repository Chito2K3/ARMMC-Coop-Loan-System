'use client';

import { useUser } from '@/firebase/provider';
import { useAuth } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { LogOut, BarChart3, CheckCircle2, DollarSign } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useCollection, useMemoFirebase } from '@/firebase';
import Link from 'next/link';
import type { Loan } from '@/lib/types';
import { useApprovalPanel } from './approval-context';

export function Sidebar() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { setShowApprovalPanel, setShowSalaryInputPanel } = useApprovalPanel();
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

  const loansQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'loans'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: loans } = useCollection<Loan>(loansQuery);

  const pendingApprovalCount = useMemo(() => {
    if (!loans || userRole !== 'approver') return 0;
    return loans.filter(loan => loan.status === 'pending').length;
  }, [loans, userRole]);

  const salaryInputCount = useMemo(() => {
    if (!loans || userRole !== 'payrollChecker') return 0;
    return loans.filter(loan => loan.status === 'pending' && (!loan.salary || loan.salary === 0)).length;
  }, [loans, userRole]);

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
        <Link href="/reports" className="w-full block">
          <Button variant="ghost" className="w-full justify-start">
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports
          </Button>
        </Link>
        {userRole === 'approver' && (
          <div className="relative inline-block w-full">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowApprovalPanel(true)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              For Approval
            </Button>
            {pendingApprovalCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                {pendingApprovalCount}
              </span>
            )}
          </div>
        )}
        {userRole === 'payrollChecker' && (
          <div className="relative inline-block w-full">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setShowSalaryInputPanel(true)}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Input Salary
            </Button>
            {salaryInputCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                {salaryInputCount}
              </span>
            )}
          </div>
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
