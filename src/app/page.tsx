import { Header } from '@/components/header';
import { DashboardWrapper } from '@/components/dashboard-wrapper';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto py-6 px-4 md:px-6">
        <DashboardWrapper />
      </main>
    </div>
  );
}
