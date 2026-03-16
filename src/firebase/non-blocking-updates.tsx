'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import {FirestorePermissionError} from '@/firebase/errors';

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options?: SetOptions) {
  setDoc(docRef, data, options || {}).catch(error => {
    console.error('Error setting document:', error);
    if (error.code === 'permission-denied') {
      console.warn('Permission denied setting document at:', docRef.path);
    }
  })
  // Execution continues immediately
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Does NOT await the write operation internally.
 * Returns the Promise for the new doc ref, but typically not awaited by caller.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const promise = addDoc(colRef, data)
    .catch(error => {
      console.error('Error adding document:', error);
      if (error.code === 'permission-denied') {
        console.warn('Permission denied adding to collection:', colRef.path);
      }
      throw error;
    });
  return promise;
}


/**
 * Initiates an updateDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  updateDoc(docRef, data)
    .catch(error => {
      console.error('Error updating document:', error);
      // Only emit permission errors if they're severe, otherwise just log
      if (error.code === 'permission-denied') {
        console.warn('Permission denied updating document at:', docRef.path);
      }
    });
}


/**
 * Initiates a deleteDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef)
    .catch(error => {
      console.error('Error deleting document:', error);
      if (error.code === 'permission-denied') {
        console.warn('Permission denied deleting document at:', docRef.path);
      }
    });
}