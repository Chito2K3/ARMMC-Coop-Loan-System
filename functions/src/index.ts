import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const handleRepayment = functions.firestore
  .document('loans/{loanId}/payments/{paymentId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const loanId = context.params.loanId;

    // We only care if the actualAmountPaid changed and is now a valid number
    if (
      beforeData.actualAmountPaid === afterData.actualAmountPaid ||
      typeof afterData.actualAmountPaid !== 'number'
    ) {
      return null;
    }

    const amountDue = afterData.amount;
    const actualPaid = afterData.actualAmountPaid;

    // We only process if there is a shortfall
    if (actualPaid >= amountDue) {
      return null;
    }

    const shortfall = amountDue - actualPaid;
    const monthlyPenalty = shortfall * 0.02;

    const db = admin.firestore();
    const loanRef = db.collection('loans').doc(loanId);
    const paymentRef = change.after.ref;

    try {
      await db.runTransaction(async (transaction) => {
        // 1. Update the payment document to record the shortfall and calculated 2% penalty
        transaction.update(paymentRef, {
          shortfall_recorded: shortfall,
          monthly_penalty: monthlyPenalty,
        });

        // 2. Increment the parent loan's historical_shortfall_bucket
        transaction.update(loanRef, {
          historical_shortfall_bucket: admin.firestore.FieldValue.increment(shortfall),
        });
      });

      console.log(`Successfully processed shortfall of ${shortfall} for payment on loan ${loanId}`);
      return null;
    } catch (error) {
      console.error('Error handling repayment transaction:', error);
      throw new functions.https.HttpsError('internal', 'Transaction failed');
    }
  });
