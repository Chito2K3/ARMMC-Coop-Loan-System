import { Header } from "@/components/header";
import { LoanDetailView } from "@/components/loan-detail-view";

type LoanDetailPageProps = {
  params: { id: string };
};

export default function LoanDetailPage({ params }: LoanDetailPageProps) {
  // The initial loan data will now be fetched by the client component
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto py-6 px-4 md:px-6">
        <LoanDetailView loanId={params.id} />
      </main>
    </div>
  );
}
