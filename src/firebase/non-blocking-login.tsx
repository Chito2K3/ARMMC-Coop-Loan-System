'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance);
}

/** Initiate email/password sign-up. */
export async function initiateEmailSignUp(authInstance: Auth, email: string, password: string): Promise<void> {
  await createUserWithEmailAndPassword(authInstance, email, password);
}

/** Initiate email/password sign-in. */
export async function initiateEmailSignIn(authInstance: Auth, email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(authInstance, email, password);
}

/** Initiate Google sign-in using popup (with better error handling). */
export async function initiateGoogleSignIn(authInstance: Auth): Promise<void> {
  const { GoogleAuthProvider, signInWithPopup } = require('firebase/auth');
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: 'select_account'
  });

  console.log('Attempting Google Sign-In...');
  console.log('Auth instance:', authInstance);
  console.log('Provider:', provider);

  try {
    const result = await signInWithPopup(authInstance, provider);
    console.log('Sign-in successful!', result);
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error object:', JSON.stringify(error, null, 2));
    throw error;
  }
}
