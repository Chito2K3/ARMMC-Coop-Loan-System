import { LoanDetailView } from "@/components/loan-detail-view-new";

type LoanDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function LoanDetailPage({ params }: LoanDetailPageProps) {
  const { id } = await params;

  return (
    <LoanDetailView loanId={id} />
  );
}
