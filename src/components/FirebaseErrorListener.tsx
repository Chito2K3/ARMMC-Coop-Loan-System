'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * Only throws critical permission errors, logs others for debugging.
 */
export function FirebaseErrorListener() {
  // Use the specific error type for the state for type safety.
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    // The callback now expects a strongly-typed error, matching the event payload.
    const handleError = (error: FirestorePermissionError) => {
      try {
        // Log all permission errors for debugging
        console.warn('Permission error detected:', error.message);
        
        // Only throw critical permission errors (e.g., reading a document you don't have access to)
        // Don't throw errors for updates which might be handled by the UI
        const isCritical = error.message && (
          error.message.includes('get') || 
          error.message.includes('list')
        );
        
        if (isCritical) {
          setError(error);
        }
      } catch (err) {
        console.error('Failed to handle error:', err);
      }
    };

    // The typed emitter will enforce that the callback for 'permission-error'
    // matches the expected payload type (FirestorePermissionError).
    errorEmitter.on('permission-error', handleError);

    // Unsubscribe on unmount to prevent memory leaks.
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // On re-render, if an error exists in state, throw it.
  if (error) {
    throw error;
  }

  // This component renders nothing.
  return null;
}
