'use client';

import React, { createContext, useContext, useState } from 'react';

interface ApprovalContextType {
  showApprovalPanel: boolean;
  setShowApprovalPanel: (show: boolean) => void;
  showSalaryInputPanel: boolean;
  setShowSalaryInputPanel: (show: boolean) => void;
}

const ApprovalContext = createContext<ApprovalContextType | undefined>(undefined);

export function ApprovalProvider({ children }: { children: React.ReactNode }) {
  const [showApprovalPanel, setShowApprovalPanel] = useState(false);
  const [showSalaryInputPanel, setShowSalaryInputPanel] = useState(false);

  return (
    <ApprovalContext.Provider value={{ showApprovalPanel, setShowApprovalPanel, showSalaryInputPanel, setShowSalaryInputPanel }}>
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
