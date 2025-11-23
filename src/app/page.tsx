import { Header } from '@/components/header';
import { DashboardClient } from '@/components/dashboard-client';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto py-6 px-4 md:px-6">
        <DashboardClient />
      </main>
    </div>
  );
}
