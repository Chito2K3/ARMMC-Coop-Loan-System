import { Header } from "@/components/header";
import { LoanDetailView } from "@/components/loan-detail-view";

type LoanDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LoanDetailPage({ params }: LoanDetailPageProps) {
  const { id } = await params;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto py-6 px-4 md:px-6">
        <LoanDetailView loanId={id} />
      </main>
    </div>
  );
}
