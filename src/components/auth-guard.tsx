'use client';

import { useUser } from "@/firebase/provider";
import { LoginPage } from "@/components/login-page";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useFirestore } from "@/firebase/provider";
import { doc, getDoc } from "firebase/firestore";

export function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const pathname = usePathname();
    const [isRoleChecked, setIsRoleChecked] = useState(false);

    useEffect(() => {
        if (isUserLoading || !user) {
            setIsRoleChecked(true);
            return;
        }

        const checkRole = async () => {
            try {
                const userRef = doc(firestore, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                
                if (userSnap.exists()) {
                    const role = userSnap.data().role;
                    if (role === 'admin' && !pathname.startsWith('/admin')) {
                        router.push('/admin');
                        return;
                    } else if (role !== 'admin' && pathname.startsWith('/admin')) {
                        router.push('/');
                        return;
                    }
                }
            } catch (err) {
                console.error('Failed to check role:', err);
            } finally {
                setIsRoleChecked(true);
            }
        };

        checkRole();
    }, [user, isUserLoading, firestore, router, pathname]);

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

    return <>{children}</>;
}
