import { Header } from '@/components/header';
import { DashboardClient } from '@/components/dashboard-client';
import { getLoans } from '@/app/actions';

export default async function Home() {
  // Fetch initial data on the server
  const initialLoans = await getLoans({});

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto py-6 px-4 md:px-6">
        <DashboardClient initialLoans={initialLoans} />
      </main>
    </div>
  );
}
