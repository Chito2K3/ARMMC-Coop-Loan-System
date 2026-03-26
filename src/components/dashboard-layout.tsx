'use client';

import * as React from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { ApprovalProvider } from './approval-context';
import { cn } from '@/lib/utils';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);

  return (
    <ApprovalProvider>
      <div className="flex flex-col lg:flex-row min-h-screen bg-background">
        <Sidebar 
          isExpanded={isSidebarExpanded} 
          onToggle={() => setIsSidebarExpanded(!isSidebarExpanded)} 
        />
        <div className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out",
          isSidebarExpanded ? "lg:ml-64" : "lg:ml-16"
        )}>
          <Header
            isSidebarExpanded={isSidebarExpanded}
            onToggleSidebar={() => setIsSidebarExpanded(!isSidebarExpanded)}
          />
          <main className="flex-1 p-4 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </ApprovalProvider>
  );
}
