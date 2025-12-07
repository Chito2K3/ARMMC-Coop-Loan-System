'use client';

import Link from "next/link";
import { Settings, Menu } from "lucide-react";
import Image from "next/image";
import { Button } from "./ui/button";
import { useAuth, useUser, useFirestore } from "@/firebase/provider";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

export function Header() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchUserRole = async () => {
      try {
        // First try to get by UID
        const userRef = doc(firestore, 'users', user.uid);
        let userSnap = await getDoc(userRef);
        
        // If not found by UID, search by email
        if (!userSnap.exists()) {
          const usersRef = collection(firestore, 'users');
          const q = query(usersRef, where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            userSnap = querySnapshot.docs[0];
          }
        }
        
        if (userSnap.exists()) {
          setUserRole(userSnap.data().role);
          setUserName(userSnap.data().name);
        }
      } catch (err) {
        console.error('Failed to fetch user role:', err);
      }
    };

    fetchUserRole();
  }, [user, firestore]);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
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
