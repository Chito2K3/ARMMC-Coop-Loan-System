'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useFirestore } from "@/firebase/provider";
import { initiateEmailSignIn, initiateEmailSignUp } from "@/firebase/non-blocking-login";
import { getOrCreateUser } from "@/firebase/user-service";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { signOut } from "firebase/auth";

export function LoginPage() {
    const auth = useAuth();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!auth || !firestore) return;

        setError("");
        setIsLoading(true);

        try {
            if (isSignUp) {
                await initiateEmailSignUp(auth, email, password);
            } else {
                await initiateEmailSignIn(auth, email, password);
            }
            const user = auth.currentUser;
            if (user) {
                const userProfile = await getOrCreateUser(firestore, user.uid, user.email || "", user.displayName || email);
                
                // If user not found in Firestore, sign them out
                if (!userProfile) {
                    await signOut(auth);
                    setError("User account not found. Please contact your administrator.");
                    setIsLoading(false);
                    return;
                }
            }
        } catch (error: any) {
            console.error("Authentication failed:", error);

            let errorMessage = "Authentication failed. Please try again.";

            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "This email is already registered. Please sign in instead.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Invalid email address.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "Password should be at least 6 characters.";
            } else if (error.code === 'auth/user-not-found') {
                errorMessage = "No account found with this email.";
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = "Incorrect password.";
            } else if (error.code === 'auth/invalid-credential') {
                errorMessage = "Invalid email or password.";
            }

            setError(errorMessage);
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md border-border/50 shadow-xl bg-card/50 backdrop-blur-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">
                        {isSignUp ? "Create Account" : "Welcome Back"}
                    </CardTitle>
                    <CardDescription>
                        {isSignUp
                            ? "Sign up to access the ARMMC Coop Loan System"
                            : "Sign in to access the ARMMC Coop Loan System"
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                                minLength={6}
                            />
                        </div>

                        {error && (
                            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            disabled={isLoading || !auth}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {isSignUp ? "Creating Account..." : "Signing In..."}
                                </>
                            ) : (
                                isSignUp ? "Sign Up" : "Sign In"
                            )}
                        </Button>

                        <div className="text-center text-sm">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    setError("");
                                }}
                                className="text-primary hover:underline"
                                disabled={isLoading}
                            >
                                {isSignUp
                                    ? "Already have an account? Sign in"
                                    : "Don't have an account? Sign up"
                                }
                            </button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
