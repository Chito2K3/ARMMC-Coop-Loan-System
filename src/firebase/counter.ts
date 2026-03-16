import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    Firestore
} from "firebase/firestore";

export async function getNextLoanNumber(firestore: Firestore): Promise<number> {
    if (!firestore) {
        throw new Error("Firestore instance is required");
    }
    try {
        const loansRef = collection(firestore, "loans");
        // Query the loans collection for the highest loanNumber
        const q = query(loansRef, orderBy("loanNumber", "desc"), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const lastLoan = querySnapshot.docs[0].data();
            const loanNumber = lastLoan.loanNumber;
            if (typeof loanNumber !== 'number' || loanNumber < 0) {
                throw new Error("Invalid loan number in database");
            }
            return loanNumber + 1;
        }

        return 1;
    } catch (error) {
        console.error("Error getting next loan number:", error);
        throw new Error(`Failed to generate loan number: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
