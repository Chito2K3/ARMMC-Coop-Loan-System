'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener'
import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

interface FirebaseProviderProps {
    children: ReactNode;
    firebaseApp: FirebaseApp;
    firestore: Firestore;
    auth: Auth;
}

// Internal state for user authentication
interface UserAuthState {
    user: User | null;
    isUserLoading: boolean;
    userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
    areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
    firebaseApp: FirebaseApp | null;
    firestore: Firestore | null;
    auth: Auth | null; // The Auth service instance
    // User authentication state
    user: User | null;
    isUserLoading: boolean; // True during initial auth check
    userError: Error | null; // Error from auth listener
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser {
    firebaseApp: FirebaseApp;
    firestore: Firestore;
    auth: Auth;
    user: User | null;
    isUserLoading: boolean;
    userError: Error | null;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult { // Renamed from UserAuthHookResult for consistency if desired, or keep as UserAuthHookResult
    user: User | null;
    isUserLoading: boolean;
    userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
    children,
    firebaseApp,
    firestore,
    auth,
}) => {
    const [userAuthState, setUserAuthState] = useState<UserAuthState>({
        user: null,
        isUserLoading: true, // Start loading until first auth event
        userError: null,
    });

    // Effect to subscribe to Firebase auth state changes
    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!auth) { // If no Auth service instance, cannot determine user state
            setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth service not provided.") });
            return;
        }

        setUserAuthState({ user: null, isUserLoading: true, userError: null }); // Reset on auth instance change

        const unsubscribe = onAuthStateChanged(
            auth,
            (firebaseUser) => { // Auth state determined
                    setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });

                    // Ensure there is a `users/{uid}` document for security rule checks.
                    // If a user document exists keyed by email only, copy it to the UID-based doc.
                    (async () => {
                        try {
                            if (!firebaseUser || !firestore) return;
                            const uid = firebaseUser.uid;
                            const userRef = doc(firestore, 'users', uid);
                            const userSnap = await getDoc(userRef);
                            if (userSnap.exists()) return; // already present

                            // Try to find by email
                            const email = firebaseUser.email || '';
                            if (!email) {
                                // create a minimal doc so rules that lookup by uid succeed
                                await setDoc(userRef, {
                                    email: '',
                                    name: firebaseUser.displayName || '',
                                    role: 'user',
                                    createdAt: serverTimestamp(),
                                    updatedAt: serverTimestamp(),
                                });
                                return;
                            }

                            const usersRef = collection(firestore, 'users');
                            const q = query(usersRef, where('email', '==', email));
                            const qs = await getDocs(q);
                            if (!qs.empty) {
                                const data = qs.docs[0].data();
                                await setDoc(userRef, {
                                    email: data.email || email,
                                    name: data.name || firebaseUser.displayName || '',
                                    role: data.role || 'user',
                                    createdAt: data.createdAt || serverTimestamp(),
                                    updatedAt: serverTimestamp(),
                                });
                            } else {
                                // No existing record by email — create minimal user doc keyed by uid
                                await setDoc(userRef, {
                                    email,
                                    name: firebaseUser.displayName || '',
                                    role: 'user',
                                    createdAt: serverTimestamp(),
                                    updatedAt: serverTimestamp(),
                                });
                            }
                        } catch (err) {
                            console.error('Error ensuring user doc for UID:', err);
                        }
                    })();
            },
            (error) => { // Auth listener error
                console.error("FirebaseProvider: onAuthStateChanged error:", (error as any).code || 'unknown', error.message || 'No message');
                setUserAuthState({ user: null, isUserLoading: false, userError: error });
            }
        );
        return () => unsubscribe(); // Cleanup
    }, [auth, firestore]); // Depends on the auth instance and firestore
    /* eslint-enable react-hooks/set-state-in-effect */

    // Memoize the context value
    const contextValue = useMemo((): FirebaseContextState => {
        const servicesAvailable = !!(firebaseApp && firestore && auth);
        return {
            areServicesAvailable: servicesAvailable,
            firebaseApp: servicesAvailable ? firebaseApp : null,
            firestore: servicesAvailable ? firestore : null,
            auth: servicesAvailable ? auth : null,
            user: userAuthState.user,
            isUserLoading: userAuthState.isUserLoading,
            userError: userAuthState.userError,
        };
    }, [firebaseApp, firestore, auth, userAuthState]);

    return (
        <FirebaseContext.Provider value={contextValue}>
            <FirebaseErrorListener />
            {children}
        </FirebaseContext.Provider>
    );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
    // `useContext` must be called unconditionally per Hooks rules.
    const context = useContext(FirebaseContext);

    // During build time (SSR/SSG), return mock values to prevent errors.
    if (typeof window === 'undefined') {
        return {
            firebaseApp: null as any,
            firestore: null as any,
            auth: null as any,
            user: null,
            isUserLoading: true,
            userError: null,
        };
    }

    if (context === undefined) {
        throw new Error('useFirebase must be used within a FirebaseProvider.');
    }

    if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth) {
        throw new Error('Firebase core services not available. Check FirebaseProvider props.');
    }

    return {
        firebaseApp: context.firebaseApp,
        firestore: context.firestore,
        auth: context.auth,
        user: context.user,
        isUserLoading: context.isUserLoading,
        userError: context.userError,
    };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
    const { auth } = useFirebase();
    return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
    const { firestore } = useFirebase();
    return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
    const { firebaseApp } = useFirebase();
    return firebaseApp;
};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => factory(), deps);
  if (result && typeof result === 'object') {
    (result as any).__memo = true;
  }
  return result;
}

/**
 * Hook specifically for accessing the authenticated user's state.
 * This provides the User object, loading status, and any auth errors.
 * @returns {UserHookResult} Object with user, isUserLoading, userError.
 */
export const useUser = (): UserHookResult => { // Renamed from useAuthUser
    const { user, isUserLoading, userError } = useFirebase(); // Leverages the main hook
    return { user, isUserLoading, userError };
};
