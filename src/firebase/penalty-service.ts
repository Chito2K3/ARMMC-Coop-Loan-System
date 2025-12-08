import { doc, getDoc, setDoc, Firestore, serverTimestamp } from 'firebase/firestore';
import type { PenaltySettings } from '@/lib/types';

const SETTINGS_DOC = 'penaltySettings';
const SETTINGS_COLLECTION = 'settings';

const DEFAULT_SETTINGS: Omit<PenaltySettings, 'updatedAt' | 'updatedBy'> = {
  penaltyAmount: 500,
  gracePeriodDays: 3,
};

export async function getPenaltySettings(firestore: Firestore): Promise<PenaltySettings> {
  try {
    const docRef = doc(firestore, SETTINGS_COLLECTION, SETTINGS_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        penaltyAmount: data.penaltyAmount,
        gracePeriodDays: data.gracePeriodDays,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      };
    }
  } catch (error) {
    console.warn('Could not fetch penalty settings, using defaults:', error);
  }

  return {
    ...DEFAULT_SETTINGS,
    updatedAt: new Date(),
    updatedBy: 'system',
  };
}

export async function updatePenaltySettings(
  firestore: Firestore,
  penaltyAmount: number,
  gracePeriodDays: number,
  userId: string
): Promise<void> {
  const docRef = doc(firestore, SETTINGS_COLLECTION, SETTINGS_DOC);
  await setDoc(docRef, {
    penaltyAmount,
    gracePeriodDays,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}
