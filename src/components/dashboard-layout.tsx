'use client';

import { Sidebar } from './sidebar';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row">
      <Sidebar />
      <div className="flex-1 min-h-screen bg-background lg:ml-64">
        <div className="p-4 md:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
