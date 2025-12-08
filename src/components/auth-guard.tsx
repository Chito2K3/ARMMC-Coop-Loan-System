'use client';

import { useUser } from "@/firebase/provider";
import { LoginPage } from "@/components/login-page";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useFirestore } from "@/firebase/provider";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";

const LoadingSpinner = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
);

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const pathname = usePathname();
    const [isRoleChecked, setIsRoleChecked] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [shouldShowContent, setShouldShowContent] = useState(false);
    const previousUserRef = useRef<string | null>(null);

    useEffect(() => {
        if (isUserLoading) {
            // Still loading auth state, don't do anything yet
            return;
        }

        if (!user || !firestore) {
            // No user logged in or firestore not available
            setIsRoleChecked(true);
            setIsAuthorized(false);
            setShouldShowContent(false);
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
                    const role = querySnapshot.docs[0].data().role;
                    const isAdminPath = pathname.startsWith('/admin');
                    const isAdmin = role === 'admin';

                    // Check if user is accessing admin path without admin role
                    if (isAdminPath && !isAdmin) {
                        setShouldShowContent(false);
                        setIsAuthorized(false);
                        router.push('/');
                    } else {
                        // User has valid access to current path
                        setShouldShowContent(true);
                        setIsAuthorized(true);
                    }
                } else {
                    // User document doesn't exist - create one with default role
                    const userId = user.email?.replace(/[^a-zA-Z0-9]/g, '_') || user.uid;
                    const now = new Date();

                    await setDoc(doc(firestore, 'users', userId), {
                        email: user.email,
                        name: user.displayName || user.email?.split('@')[0] || 'User',
                        role: 'bookkeeper', // Default role for new users
                        createdAt: now,
                        updatedAt: now,
                    });

                    // After creating the user, allow them to access the app
                    setShouldShowContent(true);
                    setIsAuthorized(true);
                }
                previousUserRef.current = user.uid;
            } catch (err) {
                console.error('Failed to check role:', err);
                if (isMounted) {
                    setShouldShowContent(false);
                    setIsAuthorized(false);
                }
            } finally {
                if (isMounted) {
                    setIsRoleChecked(true);
                }
            }
        };

        checkRole();

        return () => {
            isMounted = false;
        };
    }, [user, isUserLoading, firestore, router, pathname]);

    if (isUserLoading) {
        return <LoadingSpinner />;
    }

    if (!user) {
        return <LoginPage />;
    }

    if (!isRoleChecked || !shouldShowContent) {
        return <LoadingSpinner />;
    }

    return <>{children}</>;
}
