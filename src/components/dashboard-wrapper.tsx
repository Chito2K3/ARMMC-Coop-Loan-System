'use client';

import { DashboardClient } from './dashboard-client';
import { useApprovalPanel } from './approval-context';

export function DashboardWrapper() {
  const { showApprovalPanel, setShowApprovalPanel } = useApprovalPanel();

  return (
    <DashboardClient 
      showApprovalPanel={showApprovalPanel} 
      onShowApprovalPanel={setShowApprovalPanel}
    />
  );
}
