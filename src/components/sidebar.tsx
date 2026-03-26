'use client';

import { useUser } from '@/firebase/provider';
import { useAuth } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { LogOut, BarChart3, Home, Settings, ChevronLeft, ChevronRight, User, Banknote, ClipboardCheck, DollarSign } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy, doc, getDoc, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useCollection, useMemoFirebase } from '@/firebase';
import { useApprovalPanel } from './approval-context';
import Link from 'next/link';
import type { Loan } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function Sidebar({ isExpanded, onToggle }: SidebarProps) {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { setShowApprovalPanel, setShowSalaryInputPanel, setShowReleasePanel, setSelectedLoanId } = useApprovalPanel();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (user && firestore) {
      const fetchUserData = async () => {
        try {
          const userDocRef = doc(firestore, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            setUserName(userData.name);
            setUserRole(userData.role);
          } else {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            const snapshot = await getDocs(q);
            const userData = snapshot.docs[0]?.data();
            if (userData) {
              setUserName(userData.name);
              setUserRole(userData.role);
            }
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

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const NavItem = ({ href, icon: Icon, label, badge, onClick }: any) => {
    const content = (
      <Button 
        variant="ghost" 
        className={cn(
          "w-full transition-all duration-200",
          isExpanded ? "justify-start px-4" : "justify-center px-0 h-10 w-10 mx-auto"
        )}
        onClick={onClick}
      >
        <Icon className={cn("h-5 w-5", isExpanded ? "mr-3" : "mr-0")} />
        {isExpanded && <span className="truncate">{label}</span>}
        {isExpanded && badge > 0 && (
          <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[1.2rem] text-center">
            {badge}
          </span>
        )}
      </Button>
    );

    if (onClick && !href) {
      return isExpanded ? content : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{content}</TooltipTrigger>
            <TooltipContent side="right">
              {label} {badge > 0 && `(${badge})`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Link href={href || '#'} className="w-full block">
        {isExpanded ? content : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{content}</TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </Link>
    );
  };

  return (
    <div className={cn(
      "hidden lg:flex flex-col bg-white border-r border-[#E2E8F0] h-screen fixed left-0 top-0 transition-all duration-300 ease-in-out z-40",
      isExpanded ? "w-64" : "w-16"
    )}>
      {/* Sidebar Header / Logo area */}
      <div className={cn(
        "h-16 flex items-center border-b border-[#E2E8F0] px-4 overflow-hidden",
        isExpanded ? "justify-between" : "justify-center"
      )}>
        {isExpanded && (
          <span className="font-bold text-lg text-primary truncate">ARMMC</span>
        )}
        <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8 text-muted-foreground hover:text-foreground">
          {isExpanded ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </Button>
      </div>

      {/* User Info */}
      <div className={cn(
        "py-6 px-4 flex flex-col items-center border-b border-[#E2E8F0]",
        !isExpanded && "py-4 px-0"
      )}>
        <div className={cn(
          "bg-muted rounded-full flex items-center justify-center text-muted-foreground",
          isExpanded ? "h-12 w-12 mb-3" : "h-10 w-10"
        )}>
          {userName ? (
            <span className="font-semibold text-sm">
              {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </span>
          ) : (
            <User className="h-5 w-5" />
          )}
        </div>
        {isExpanded && (
          <div className="text-center w-full overflow-hidden">
            <h2 className="text-sm font-semibold text-foreground truncate">{userName || 'User'}</h2>
            <p className="text-xs text-muted-foreground capitalize truncate">{userRole?.replace(/([A-Z])/g, ' $1').trim() || 'Loading...'}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-6 space-y-4 overflow-y-auto overflow-x-hidden">
        <div className="space-y-1">
          {userRole === 'admin' && (
            <NavItem href="/admin" icon={Home} label="Admin Dashboard" onClick={() => setSelectedLoanId(null)} />
          )}
          <NavItem href="/" icon={Home} label="Dashboard" onClick={() => setSelectedLoanId(null)} />
          <NavItem href="/reports" icon={BarChart3} label="Reports" />
          {userRole === 'admin' && (
            <NavItem href="/admin/settings" icon={Settings} label="Settings" />
          )}
        </div>

        <div className="pt-4 border-t border-[#E2E8F0] space-y-1">
          {isExpanded && <p className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Actions</p>}
          {(userRole === 'creditCommitteeMember' || userRole === 'creditCommitteeOfficer' || userRole === 'admin') && (
            <NavItem 
              icon={ClipboardCheck} 
              label="For Approval" 
              badge={approvalCount} 
              onClick={() => setShowApprovalPanel(true)} 
            />
          )}
          {(userRole === 'payrollChecker' || userRole === 'admin') && (
            <NavItem 
              icon={DollarSign} 
              label="Input Salary" 
              badge={salaryCount} 
              onClick={() => setShowSalaryInputPanel(true)} 
            />
          )}
          {(userRole === 'bookkeeper' || userRole === 'admin') && (
            <NavItem 
              icon={Banknote} 
              label="For Releasing" 
              badge={releaseCount} 
              onClick={() => setShowReleasePanel(true)} 
            />
          )}
        </div>
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-[#E2E8F0]">
        <NavItem icon={LogOut} label="Logout" onClick={handleLogout} />
      </div>
    </div>
  );
}
