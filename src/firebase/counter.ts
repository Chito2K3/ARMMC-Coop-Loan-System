import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    Firestore
} from "firebase/firestore";

export async function getNextLoanNumber(firestore: Firestore): Promise<number> {
    try {
        const loansRef = collection(firestore, "loans");
        // Query the loans collection for the highest loanNumber
        const q = query(loansRef, orderBy("loanNumber", "desc"), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const lastLoan = querySnapshot.docs[0].data();
            return (lastLoan.loanNumber || 0) + 1;
        }

        return 1;
    } catch (error) {
        console.error("Error getting next loan number:", error);
        // Fallback to timestamp-based or random if query fails, or just throw
        // For now, we'll return 1 to allow creation to proceed if it's the first one
        // or if there's an index issue (though single field index should exist)
        return 1;
    }
}
