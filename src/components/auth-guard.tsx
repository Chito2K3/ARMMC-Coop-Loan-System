'use client';

import { useUser } from "@/firebase/provider";
import { LoginPage } from "@/components/login-page";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { useAuth, useFirestore } from "@/firebase/provider";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";

const LoadingSpinner = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
);

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, isUserLoading } = useUser();
    const auth = useAuth();
    const firestore = useFirestore();
    const router = useRouter();
    const pathname = usePathname();
    const [authState, setAuthState] = useState({ isRoleChecked: false, isAuthorized: false, shouldShowContent: false });
    const previousUserRef = useRef<string | null>(null);

    useEffect(() => {
        if (isUserLoading) {
            // Still loading auth state, don't do anything yet
            return;
        }

        if (!user || !firestore) {
            // No user logged in or firestore not available
            setAuthState({ isRoleChecked: true, isAuthorized: false, shouldShowContent: false });
            return;
        }

        let isMounted = true;

        const checkRole = async () => {
            try {
                const usersRef = collection(firestore, 'users');
                const q = query(usersRef, where('email', '==', user.email));
                const querySnapshot = await getDocs(q);

                if (!isMounted) return;

                if (!querySnapshot.empty) {
                    const existingDoc = querySnapshot.docs[0];
                    const role = existingDoc.data().role;
                    
                    // CRITICAL: If the document ID is not the UID, we must migrate it
                    // so that Firestore security rules (lookup by UID) can work correctly.
                    if (existingDoc.id !== user.uid) {
                        console.log('Migrating user document ID to UID:', user.uid);
                        await setDoc(doc(firestore, 'users', user.uid), {
                            ...existingDoc.data(),
                            updatedAt: new Date(),
                        });
                    }

                    const isAdminPath = pathname.startsWith('/admin');
                    const isAdmin = role === 'admin';

                    // Check if user is accessing admin path without admin role
                    if (isAdminPath && !isAdmin) {
                        setAuthState({ isRoleChecked: true, isAuthorized: false, shouldShowContent: false });
                        router.push('/');
                    } else {
                        // User has valid access to current path
                        setAuthState({ isRoleChecked: true, isAuthorized: true, shouldShowContent: true });
                    }
                } else {
                    // STRICT MODE: User profile doesn't exist in Firestore.
                    // This means they are unauthorized or haven't been added by an Admin.
                    console.error('Unauthorized access attempt: No Firestore profile for', user.email);
                    if (auth) {
                        await signOut(auth);
                    }
                    setAuthState({ isRoleChecked: true, isAuthorized: false, shouldShowContent: false });
                }
                previousUserRef.current = user.uid;
            } catch (err) {
                console.error('Failed to check role:', err);
                if (isMounted) {
                    setAuthState({ isRoleChecked: false, isAuthorized: false, shouldShowContent: false });
                }
            } finally {
                if (isMounted) {
                    setAuthState(prev => ({ ...prev, isRoleChecked: true }));
                }
            }
        };

        checkRole();

        return () => {
            isMounted = false;
        };
    }, [user, isUserLoading, firestore, auth, router, pathname]);

    if (isUserLoading) {
        return <LoadingSpinner />;
    }

    if (!user) {
        return <LoginPage />;
    }

    if (!authState.isRoleChecked || !authState.shouldShowContent) {
        return <LoadingSpinner />;
    }

    return <>{children}</>;
}
