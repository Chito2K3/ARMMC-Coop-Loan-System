'use client';

import Link from "next/link";
import { Building2, User, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "./ui/button";
import { useAuth, useUser, useFirestore } from "@/firebase/provider";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

export function Header() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string | null>(null);

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
        }
      } catch (err) {
        console.error('Failed to fetch user role:', err);
      }
    };

    fetchUserRole();
  }, [user, firestore]);

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error) {
      console.error("Logout failed:", error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An error occurred while logging out.",
      });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold sm:inline-block bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              ARMMC Loan Manager
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          {userRole === 'admin' && (
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Admin
              </Button>
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="overflow-hidden rounded-full"
              >
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
