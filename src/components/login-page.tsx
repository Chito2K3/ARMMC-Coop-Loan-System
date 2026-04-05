'use client';

import { Label } from "@/components/ui/label";
import { useAuth, useFirestore } from "@/firebase/provider";
import { initiateEmailSignIn, initiateEmailSignUp } from "@/firebase/non-blocking-login";
import { getUser } from "@/firebase/user-service";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { useState } from "react";
import { signOut } from "firebase/auth";
import Image from "next/image";

export function LoginPage() {
    const auth = useAuth();
    const firestore = useFirestore();
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(true);
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
                try {
                    const userProfile = await getUser(firestore, user.uid, user.email || "", user.displayName || email);
                    if (!userProfile) {
                        await signOut(auth);
                        setError("User account not found. Please contact your administrator.");
                        setIsLoading(false);
                        return;
                    }
                    if (userProfile.role === 'admin') {
                        window.location.href = '/admin';
                    } else {
                        window.location.href = '/';
                    }
                } catch (userError) {
                    console.error("Error fetching user profile:", userError);
                    await signOut(auth);
                    setError("Failed to load user profile. Please try again.");
                    setIsLoading(false);
                    return;
                }
            }
        } catch (error: any) {
            console.error("Authentication failed:", error);
            const errorMessages: Record<string, string> = {
                'auth/email-already-in-use': "This email is already registered. Please sign in instead.",
                'auth/invalid-email': "Invalid email address.",
                'auth/weak-password': "Password should be at least 6 characters.",
                'auth/user-not-found': "No account found with this email.",
                'auth/wrong-password': "Incorrect password.",
                'auth/invalid-credential': "Invalid email or password.",
            };
            setError(errorMessages[error.code] || "Authentication failed. Please try again.");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)' }}>
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden p-12">
                {/* Background decorative orbs */}
                <div style={{
                    position: 'absolute', top: '-80px', left: '-80px',
                    width: '400px', height: '400px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
                    filter: 'blur(40px)'
                }} />
                <div style={{
                    position: 'absolute', bottom: '-100px', right: '-60px',
                    width: '350px', height: '350px', borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)',
                    filter: 'blur(40px)'
                }} />

                <div className="relative z-10 flex flex-col items-center text-center space-y-8">
                    {/* Logo */}
                    <div style={{
                        width: '200px', height: '200px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.98)',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 0 3px rgba(255,255,255,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0
                    }}>
                        <Image
                            src="/armmc-logo.jpg"
                            alt="ARMMC Logo"
                            width={180}
                            height={180}
                            style={{ objectFit: 'contain' }}
                            priority
                        />
                    </div>

                    {/* Coop Name */}
                    <div>
                        <h1 style={{
                            fontSize: '2rem', fontWeight: 800, color: '#ffffff',
                            letterSpacing: '-0.5px', lineHeight: 1.2,
                            textShadow: '0 2px 20px rgba(0,0,0,0.5)'
                        }}>
                            ARMMC Multi-Purpose<br />Cooperative
                        </h1>
                        <p style={{
                            marginTop: '12px', fontSize: '1rem',
                            color: 'rgba(196,181,253,0.85)', fontWeight: 500, letterSpacing: '0.5px'
                        }}>
                            Member Loan Management System
                        </p>
                    </div>

                    {/* Divider */}
                    <div style={{
                        width: '80px', height: '3px', borderRadius: '2px',
                        background: 'linear-gradient(90deg, #6366f1, #a78bfa)'
                    }} />

                    {/* Tagline */}
                    <p style={{
                        fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)',
                        maxWidth: '320px', lineHeight: 1.7, fontStyle: 'italic'
                    }}>
                        "Empowering our members through cooperative finance and mutual growth."
                    </p>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
                <div style={{
                    width: '100%', maxWidth: '420px',
                    background: 'rgba(255,255,255,0.035)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '24px',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                    padding: '40px 36px'
                }}>
                    {/* Mobile logo */}
                    <div className="flex lg:hidden justify-center mb-6">
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '50%',
                            background: 'white', overflow: 'hidden',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Image src="/armmc-logo.jpg" alt="ARMMC Logo" width={70} height={70} style={{ objectFit: 'contain' }} />
                        </div>
                    </div>

                    {/* Header */}
                    <div className="text-center mb-8">
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
                            {isSignUp ? "Create Account" : "Welcome Back"}
                        </h2>
                        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.45)' }}>
                            {isSignUp
                                ? "Register to access the Loan System"
                                : "Sign in to your cooperative account"
                            }
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} autoComplete="off" className="space-y-5">
                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 500 }}>
                                Email Address
                            </Label>
                            <div style={{ position: 'relative' }}>
                                <Mail style={{
                                    position: 'absolute', left: '14px', top: '50%',
                                    transform: 'translateY(-50%)', width: '16px', height: '16px',
                                    color: 'rgba(165,180,252,0.7)', pointerEvents: 'none'
                                }} />
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="off"
                                    readOnly={isReadOnly}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isLoading}
                                    placeholder="Enter your email"
                                    style={{
                                        width: '100%', paddingLeft: '42px', paddingRight: '16px',
                                        paddingTop: '12px', paddingBottom: '12px',
                                        background: 'rgba(255,255,255,0.07)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: '12px', color: '#000000',
                                        fontSize: '0.9rem', outline: 'none',
                                        transition: 'border-color 0.2s, background 0.2s',
                                        caretColor: '#a78bfa'
                                    }}
                                    onFocus={(e) => {
                                        setIsReadOnly(false);
                                        e.target.style.borderColor = 'rgba(167,139,250,0.6)';
                                        e.target.style.background = 'rgba(255,255,255,0.12)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(255,255,255,0.15)';
                                        e.target.style.background = 'rgba(255,255,255,0.07)';
                                    }}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                            <Label htmlFor="password" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: 500 }}>
                                Password
                            </Label>
                            <div style={{ position: 'relative' }}>
                                <Lock style={{
                                    position: 'absolute', left: '14px', top: '50%',
                                    transform: 'translateY(-50%)', width: '16px', height: '16px',
                                    color: 'rgba(165,180,252,0.7)', pointerEvents: 'none'
                                }} />
                                <input
                                    id="password"
                                    type="password"
                                    autoComplete="off"
                                    readOnly={isReadOnly}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={isLoading}
                                    minLength={6}
                                    placeholder="Enter your password"
                                    style={{
                                        width: '100%', paddingLeft: '42px', paddingRight: '16px',
                                        paddingTop: '12px', paddingBottom: '12px',
                                        background: 'rgba(255,255,255,0.07)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: '12px', color: '#000000',
                                        fontSize: '0.9rem', outline: 'none',
                                        transition: 'border-color 0.2s, background 0.2s',
                                        caretColor: '#a78bfa'
                                    }}
                                    onFocus={(e) => {
                                        setIsReadOnly(false);
                                        e.target.style.borderColor = 'rgba(167,139,250,0.6)';
                                        e.target.style.background = 'rgba(255,255,255,0.12)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = 'rgba(255,255,255,0.15)';
                                        e.target.style.background = 'rgba(255,255,255,0.07)';
                                    }}
                                />
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                padding: '12px 14px', borderRadius: '10px',
                                background: 'rgba(239,68,68,0.15)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                color: '#fca5a5', fontSize: '0.85rem'
                            }}>
                                <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '1px' }} />
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || !auth}
                            style={{
                                width: '100%', padding: '13px',
                                background: isLoading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                color: 'white', fontWeight: 700, fontSize: '0.95rem',
                                borderRadius: '12px', border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                                transition: 'opacity 0.2s, transform 0.15s',
                                boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                marginTop: '8px'
                            }}
                            onMouseEnter={(e) => { if (!isLoading) (e.target as HTMLButtonElement).style.opacity = '0.9'; }}
                            onMouseLeave={(e) => { if (!isLoading) (e.target as HTMLButtonElement).style.opacity = '1'; }}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                                    {isSignUp ? "Creating Account..." : "Signing In..."}
                                </>
                            ) : (
                                isSignUp ? "Create Account" : "Sign In"
                            )}
                        </button>

                        {/* Toggle */}
                        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>
                            {isSignUp ? "Already have an account? " : "Don't have an account? "}
                            <button
                                type="button"
                                onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: '#a78bfa', fontWeight: 600, fontSize: '0.85rem',
                                    textDecoration: 'underline', textUnderlineOffset: '3px'
                                }}
                            >
                                {isSignUp ? "Sign In" : "Sign Up"}
                            </button>
                        </p>
                    </form>
                </div>

                {/* Footer */}
                <p style={{
                    position: 'fixed', bottom: '16px', left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)',
                    whiteSpace: 'nowrap'
                }}>
                    © 2026 ARMMC Multi-Purpose Cooperative. All rights reserved.
                </p>
            </div>
        </div>
    );
}
