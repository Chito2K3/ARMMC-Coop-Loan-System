import { Header } from '@/components/header';
import { AdminDashboard } from '@/components/admin-dashboard';

export default function AdminPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto py-6 px-4 md:px-6">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users and their roles.</p>
        </div>
        <AdminDashboard />
      </main>
    </div>
  );
}
