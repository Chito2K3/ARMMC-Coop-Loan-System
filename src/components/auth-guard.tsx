'use client';

import { useUser } from "@/firebase/provider";
import { LoginPage } from "@/components/login-page";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useFirestore } from "@/firebase/provider";
import { collection, query, where, getDocs } from "firebase/firestore";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const pathname = usePathname();
    const [isRoleChecked, setIsRoleChecked] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [previousUser, setPreviousUser] = useState<string | null>(null);
    const [shouldShowContent, setShouldShowContent] = useState(false);

    useEffect(() => {
        if (isUserLoading || !user || !firestore) {
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

                // Check if user just logged in (different from previous user)
                const isNewLogin = previousUser !== user.uid;
                
                if (!querySnapshot.empty) {
                    const role = querySnapshot.docs[0].data().role;
                    const isAdminPath = pathname.startsWith('/admin');
                    const isAdmin = role === 'admin';
                    
                    if (isNewLogin) {
                        // On new login, redirect to appropriate home page
                        setShouldShowContent(false);
                        if (isAdmin) {
                            router.push('/admin');
                        } else {
                            router.push('/');
                        }
                        setIsAuthorized(false);
                    } else if (isAdminPath && !isAdmin) {
                        setShouldShowContent(false);
                        router.push('/');
                        setIsAuthorized(false);
                    } else if (!isAdminPath && isAdmin) {
                        setShouldShowContent(false);
                        router.push('/admin');
                        setIsAuthorized(false);
                    } else {
                        setShouldShowContent(true);
                        setIsAuthorized(true);
                    }
                } else {
                    setShouldShowContent(true);
                    setIsAuthorized(true);
                }
                setPreviousUser(user.uid);
            } catch (err) {
                console.error('Failed to check role:', err);
                if (isMounted) {
                    setShouldShowContent(true);
                    setIsAuthorized(true);
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
    }, [user, isUserLoading, firestore, router, pathname, previousUser]);

    if (isUserLoading || !isRoleChecked) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return <LoginPage />;
    }

    if (!shouldShowContent) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return <>{children}</>;
}
