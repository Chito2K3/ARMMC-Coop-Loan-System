'use client';

import React, { createContext, useContext, useState } from 'react';

interface ApprovalContextType {
  showApprovalPanel: boolean;
  setShowApprovalPanel: (show: boolean) => void;
  showSalaryInputPanel: boolean;
  setShowSalaryInputPanel: (show: boolean) => void;
  showPastDuePanel: boolean;
  setShowPastDuePanel: (show: boolean) => void;
  showReleasePanel: boolean;
  setShowReleasePanel: (show: boolean) => void;
  selectedLoanId: string | null;
  setSelectedLoanId: (id: string | null) => void;
}

const ApprovalContext = createContext<ApprovalContextType | undefined>(undefined);

export function ApprovalProvider({ children }: { children: React.ReactNode }) {
  const [showApprovalPanel, setShowApprovalPanel] = useState(false);
  const [showSalaryInputPanel, setShowSalaryInputPanel] = useState(false);
  const [showPastDuePanel, setShowPastDuePanel] = useState(false);
  const [showReleasePanel, setShowReleasePanel] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

  const value = React.useMemo(
    () => ({
      showApprovalPanel,
      setShowApprovalPanel,
      showSalaryInputPanel,
      setShowSalaryInputPanel,
      showPastDuePanel,
      setShowPastDuePanel,
      showReleasePanel,
      setShowReleasePanel,
      selectedLoanId,
      setSelectedLoanId,
    }),
    [showApprovalPanel, showSalaryInputPanel, showPastDuePanel, showReleasePanel, selectedLoanId]
  );

  return (
    <ApprovalContext.Provider value={value}>
      {children}
    </ApprovalContext.Provider>
  );
}

export function useApprovalPanel() {
  const context = useContext(ApprovalContext);
  if (!context) {
    throw new Error('useApprovalPanel must be used within ApprovalProvider');
  }
  return context;
}
