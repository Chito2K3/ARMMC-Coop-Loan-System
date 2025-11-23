import { Header } from "@/components/header";
import { getLoanById } from "@/app/actions";
import { LoanDetailView } from "@/components/loan-detail-view";
import { notFound } from "next/navigation";

type LoanDetailPageProps = {
  params: { id: string };
};

export default async function LoanDetailPage({ params }: LoanDetailPageProps) {
  const loan = await getLoanById(params.id);

  if (!loan) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto py-6 px-4 md:px-6">
        <LoanDetailView initialLoan={loan} />
      </main>
    </div>
  );
}
