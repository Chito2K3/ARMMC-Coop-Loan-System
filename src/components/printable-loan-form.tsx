'use client';

import * as React from 'react';
import type { Loan } from '@/lib/types';
import { numberToWords } from '@/lib/number-to-words';

interface PrintableLoanFormProps {
  loan: Loan;
  formRef: React.RefObject<HTMLDivElement>;
}

const formatCurrency = (value: number) => {
  if (isNaN(value) || value === undefined) return '0.00';
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

function computeLoanDetails(loan: Loan) {
  const principal = loan.amount;
  const term = loan.paymentTerm;
  const interestRate = 0.015;

  let beginningBalance = principal;
  let totalInterest = 0;
  const approxMonthlyPrincipal = principal / term;
  let totalPrincipalPaid = 0;
  const schedule = [];

  for (let month = 1; month <= term; month++) {
    const interest = beginningBalance * interestRate;
    totalInterest += interest;
    let principalPayment = 0;
    let totalMonthlyPayment = 0;

    if (month === term) {
      principalPayment = principal - totalPrincipalPaid;
      totalMonthlyPayment = principalPayment + interest;
    } else {
      const exactTotal = approxMonthlyPrincipal + interest;
      totalMonthlyPayment = Math.round(exactTotal);
      principalPayment = totalMonthlyPayment - interest;
    }
    const endingBalance = beginningBalance - principalPayment;
    schedule.push({ month, beginningBalance, interest, principal: principalPayment, endingBalance: endingBalance < 0 ? 0 : endingBalance });
    beginningBalance = endingBalance;
    totalPrincipalPaid += principalPayment;
  }

  const monthlyAmortization = Math.round(schedule[0]?.principal * 100) / 100 || 0;
  const loanTermInYears = term / 12;
  const serviceCharge = principal * 0.06 * loanTermInYears;
  const shareCapital = principal * 0.01;
  const firstMonthInterest = schedule[0]?.interest || 0;
  const firstMonthAmortization = term === 1 ? 0 : monthlyAmortization;
  const outstandingBalance = loan.outstandingBalanceAtRenewal || 0;
  const totalDeductions = serviceCharge + shareCapital + firstMonthAmortization + firstMonthInterest + outstandingBalance;
  const netProceeds = principal - totalDeductions;

  return { monthlyAmortization, serviceCharge, shareCapital, firstMonthInterest, firstMonthAmortization, totalDeductions, netProceeds, outstandingBalance, totalInterest };
}

export function PrintableLoanForm({ loan, formRef }: PrintableLoanFormProps) {
  const computation = computeLoanDetails(loan);
  const isRenewal = !!loan.renewalOf;
  const isEmergency = loan.loanType?.toLowerCase().includes('emergency');
  const isInService = loan.membershipType === 'In-Service Member';
  const isSeparated = loan.membershipType === 'Separated from Service Member';

  const createdDate = loan.createdAt instanceof Date
    ? loan.createdAt.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });

  const amountInWords = numberToWords(loan.amount);

  const cellStyle: React.CSSProperties = {
    border: '1px solid #000',
    padding: '4px 6px',
    fontSize: '9px',
    verticalAlign: 'top',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '8px',
    fontWeight: 'bold',
    marginBottom: '2px',
    display: 'block',
  };

  const lineStyle: React.CSSProperties = {
    borderBottom: '1px solid #000',
    minHeight: '14px',
    marginTop: '2px',
    marginBottom: '6px',
    display: 'block',
    fontSize: '9px',
  };

  const checkboxStyle: React.CSSProperties = {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    border: '1px solid #000',
    marginRight: '4px',
    textAlign: 'center',
    lineHeight: '10px',
    fontSize: '8px',
    verticalAlign: 'middle',
  };

  return (
    <div
      ref={formRef}
      style={{
        width: '816px', // A4 at 96dpi
        minHeight: '1056px',
        backgroundColor: '#fff',
        padding: '32px 40px',
        fontFamily: 'Arial, sans-serif',
        color: '#000',
        fontSize: '9px',
        position: 'absolute',
        top: '-9999px',
        left: '-9999px',
        zIndex: -1,
      }}
    >
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/armmc-logo.jpg" crossOrigin="anonymous" alt="ARMMC Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '10px', lineHeight: '1.4' }}>Amang Rodriguez Memorial Medical Center</div>
            <div style={{ fontSize: '9px' }}>Multi-Purpose Cooperative</div>
            <div style={{ fontSize: '9px' }}>Marikina City</div>
          </div>
        </div>
        <div style={{ border: '1px solid #000', padding: '6px 10px', fontSize: '9px', minWidth: '150px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Application #:</span>
            <span style={{ borderBottom: '1px solid #000', flex: 1 }}>{loan.loanNumber}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ fontWeight: 'bold' }}>Date:</span>
            <span style={{ borderBottom: '1px solid #000', flex: 1 }}>{createdDate}</span>
          </div>
        </div>
      </div>

      {/* TITLE */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', textDecoration: 'underline', marginBottom: '10px' }}>
        LOAN APPLICATION FORM
      </div>

      {/* NAME LINE */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', marginBottom: '6px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '9px', whiteSpace: 'nowrap' }}>Name:</span>
        <span style={{ borderBottom: '1px solid #000', flex: 1, minHeight: '14px', fontSize: '10px', fontWeight: 'bold', paddingBottom: '1px' }}>{loan.applicantName}</span>
      </div>

      {/* MEMBERSHIP TYPE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '9px' }}>Type of Membership</span>
        <span>
          <span style={{ ...checkboxStyle }}>{isInService ? '✓' : ''}</span>
          <span style={{ fontSize: '9px' }}>In-Service Member</span>
        </span>
        <span>
          <span style={{ ...checkboxStyle }}>{isSeparated ? '✓' : ''}</span>
          <span style={{ fontSize: '9px' }}>Separated from Service Member</span>
        </span>
      </div>

      {/* PURPOSE */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', marginBottom: '6px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '9px', whiteSpace: 'nowrap' }}>Purpose of Loan:</span>
        <span style={{ borderBottom: '1px solid #000', flex: 1, minHeight: '14px', fontSize: '9px', paddingBottom: '1px' }}>{loan.purpose}</span>
      </div>

      {/* AMOUNT IN WORDS */}
      <div style={{ marginBottom: '6px', fontSize: '9px' }}>
        <div>*I hereby apply for the loan of (amount in words):</div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', marginTop: '2px' }}>
          <span style={{ whiteSpace: 'nowrap' }}>( Php</span>
          <span style={{ borderBottom: '1px solid #000', flex: 1, fontSize: '9px' }}>{formatCurrency(loan.amount)}</span>
          <span>)</span>
          <span style={{ borderBottom: '1px solid #000', flex: 2, fontSize: '9px' }}>{amountInWords}</span>
        </div>
      </div>

      {/* MONTHLY AMORTIZATION ROW */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '6px', fontSize: '9px', alignItems: 'flex-end' }}>
        <span style={{ whiteSpace: 'nowrap' }}>Monthly Amortization: Amount Php</span>
        <span style={{ borderBottom: '1px solid #000', width: '90px' }}>{formatCurrency(computation.monthlyAmortization)}</span>
        <span style={{ whiteSpace: 'nowrap' }}>Pesos</span>
        <span style={{ whiteSpace: 'nowrap' }}>Terms:</span>
        <span style={{ borderBottom: '1px solid #000', width: '50px' }}>{loan.paymentTerm}</span>
        <span>month/s</span>
      </div>

      {/* TYPE OF LOAN BOX */}
      <div style={{ border: '1px solid #000', padding: '6px', marginBottom: '8px', fontSize: '9px' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
          <div>
            <span style={{ fontWeight: 'bold' }}>TYPE OF LOAN:</span>
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ ...checkboxStyle }}>{!isEmergency ? '✓' : ''}</span>
              <span>Regular Loan</span>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>
                  <span style={{ ...checkboxStyle }}>{!isRenewal ? '✓' : ''}</span>
                  <span>New</span>
                </span>
                <span>
                  <span style={{ ...checkboxStyle }}>{isRenewal && !isEmergency ? '✓' : ''}</span>
                  <span>Renewal</span>
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ ...checkboxStyle }}>{isEmergency ? '✓' : ''}</span>
              <span>Emergency Loan</span>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>
                  <span style={{ ...checkboxStyle }}>{!isRenewal ? '✓' : ''}</span>
                  <span>New</span>
                </span>
                <span>
                  <span style={{ ...checkboxStyle }}>{isRenewal && isEmergency ? '✓' : ''}</span>
                  <span>Renewal</span>
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ ...checkboxStyle }}></span>
              <span>Others, please specify:</span>
              <span style={{ borderBottom: '1px solid #000', flex: 1, marginLeft: '4px' }}></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span><span style={{ ...checkboxStyle }}></span>Clothing</span>
              <span><span style={{ ...checkboxStyle }}></span>Mid-year Bonus</span>
              <span><span style={{ ...checkboxStyle }}></span>Year-end Bonus</span>
            </div>
          </div>
        </div>
      </div>

      {/* BORROWER / CO-MAKER / CERTIFIED BY TABLE */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '9px' }}>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, width: '33%', fontWeight: 'bold' }}>BORROWER</td>
            <td style={{ ...cellStyle, width: '33%', fontWeight: 'bold' }}>CO-MAKER</td>
            <td style={{ ...cellStyle, width: '34%', fontWeight: 'bold' }}>CERTIFIED BY:</td>
          </tr>
          <tr>
            <td style={cellStyle}>
              <span style={labelStyle}>Basic Salary:</span>
              <span style={lineStyle}></span>
              <span style={labelStyle}>Monthly Net Take Home Pay:</span>
              <span style={lineStyle}></span>
              <span style={labelStyle}>Share Capital:</span>
              <span style={{ ...lineStyle, paddingBottom: '16px' }}>{formatCurrency(computation.shareCapital)}</span>
            </td>
            <td style={cellStyle}>
              <span style={labelStyle}>Basic Salary:</span>
              <span style={lineStyle}></span>
              <span style={labelStyle}>Monthly Net Take Home Pay:</span>
              <span style={lineStyle}></span>
              <span style={labelStyle}>Share Capital:</span>
              <span style={{ ...lineStyle, paddingBottom: '16px' }}></span>
            </td>
            <td style={cellStyle}>
              <div style={{ marginBottom: '8px' }}>
                <span style={labelStyle}>Payroll Officer of ARMMC:</span>
                <span style={lineStyle}></span>
                <span style={{ fontSize: '7px', display: 'block', textAlign: 'center', marginTop: '-4px' }}>Signature over Printed Name</span>
              </div>
              <div>
                <span style={labelStyle}>Recommending approval:</span>
              </div>
              <div style={{ marginBottom: '2px' }}>
                <span style={labelStyle}>Bookkeeper of ARMMC MPC:</span>
                <span style={lineStyle}></span>
                <span style={{ fontSize: '7px', display: 'block', textAlign: 'center', marginTop: '-4px' }}>Signature over Printed Name</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style={cellStyle}>
              <span style={labelStyle}>Loan Balance (if any)</span>
              <span style={labelStyle}>Regular: <span style={lineStyle}></span></span>
              <span style={labelStyle}>Emergency: <span style={lineStyle}></span></span>
              <span style={labelStyle}>Others: <span style={lineStyle}></span></span>
              <span style={labelStyle}>Total: <span style={lineStyle}></span></span>
            </td>
            <td style={cellStyle}>
              <span style={labelStyle}>Loan Balance (if any)</span>
              <span style={labelStyle}>Regular: <span style={lineStyle}></span></span>
              <span style={labelStyle}>Emergency: <span style={lineStyle}></span></span>
              <span style={labelStyle}>Others: <span style={lineStyle}></span></span>
              <span style={labelStyle}>Total: <span style={lineStyle}></span></span>
            </td>
            <td style={cellStyle}>
              {/* empty */}
            </td>
          </tr>
        </tbody>
      </table>

      {/* CREDIT COMMITTEE RECOMMENDATION */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', fontSize: '9px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 'bold' }}>Credit Committee Recommendation:</span>
        <span><span style={{ ...checkboxStyle }}></span> Approved</span>
        <span><span style={{ ...checkboxStyle }}></span> Disapproved, reason for Disapproval:</span>
        <span style={{ borderBottom: '1px solid #000', flex: 1, minWidth: '80px' }}></span>
      </div>

      {/* CREDIT COMMITTEE SIGNATURES TABLE */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '9px' }}>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, width: '33%' }}>Credit Committee Member</td>
            <td style={{ ...cellStyle, width: '33%' }}>Credit Committee (Chairperson / Vice-Chair)</td>
            <td style={{ ...cellStyle, width: '34%' }}>Noted by: (ARMMC MPC BOD Chairperson)</td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, height: '40px' }}></td>
            <td style={cellStyle}></td>
            <td style={cellStyle}></td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, fontSize: '7px', textAlign: 'center' }}>Signature over Printed Name</td>
            <td style={{ ...cellStyle, fontSize: '7px', textAlign: 'center' }}>Signature over Printed Name</td>
            <td style={{ ...cellStyle, fontSize: '7px', textAlign: 'center' }}>Signature over Printed Name</td>
          </tr>
        </tbody>
      </table>

      {/* LOAN AGREEMENT */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', textDecoration: 'underline', marginBottom: '6px' }}>
        LOAN AGREEMENT
      </div>
      <p style={{ fontSize: '8.5px', textAlign: 'justify', marginBottom: '14px', lineHeight: '1.5' }}>
        I / We hereby promise to pay ARMMC-MPC the above stated loan granted to me thru salary deduction (In-Service Member) / Over the Counter (Separated from Service) on the specified due date according to the terms and conditions set forth by the Credit Committee. Failure to comply with the said terms and conditions, I/We am/are willing to deduct any unpaid remaining balance from my share capital.
      </p>

      {/* SIGNATURE LINES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '9px' }}>
        <div style={{ textAlign: 'center', width: '40%' }}>
          <div style={{ borderBottom: '1px solid #000', marginBottom: '4px', minHeight: '30px' }}></div>
          <div style={{ fontWeight: 'bold' }}>BORROWER</div>
          <div style={{ fontSize: '7.5px' }}>(Signature over printed name)</div>
        </div>
        <div style={{ textAlign: 'center', width: '40%' }}>
          <div style={{ borderBottom: '1px solid #000', marginBottom: '4px', minHeight: '30px' }}></div>
          <div style={{ fontWeight: 'bold' }}>CO-MAKER</div>
          <div style={{ fontSize: '7.5px' }}>(Signature over printed name)</div>
        </div>
      </div>

      {/* SAMPLE LOAN COMPUTATION TABLE */}
      <div style={{ fontWeight: 'bold', fontSize: '10px', textAlign: 'center', textDecoration: 'underline', marginBottom: '6px' }}>
        SAMPLE LOAN COMPUTATION
      </div>
      <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '4px' }}>
        {isEmergency ? 'EMERGENCY LOAN' : 'REGULAR LOAN'}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
        <thead>
          <tr>
            <th style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>PRINCIPAL AMOUNT</th>
            <th style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>TERM OF LOAN</th>
            <th style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>INTEREST (1.5% diminishing per month)</th>
            <th style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>SERVICE CHARGE (6% per year)</th>
            <th style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>SHARE CAPITAL (1% retain)</th>
            <th style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>MONTHLY AMORTIZATION</th>
            <th style={{ ...cellStyle, textAlign: 'center', backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>NET PROCEEDS</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, textAlign: 'center' }}>{formatCurrency(loan.amount)}</td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>{loan.paymentTerm} Months</td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>{formatCurrency(computation.totalInterest)}</td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>{formatCurrency(computation.serviceCharge)}</td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>{formatCurrency(computation.shareCapital)}</td>
            <td style={{ ...cellStyle, textAlign: 'center' }}>{formatCurrency(computation.monthlyAmortization)}</td>
            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>{formatCurrency(computation.netProceeds)}</td>
          </tr>
        </tbody>
      </table>

      {/* FOOTER */}
      <div style={{ marginTop: '16px', fontSize: '8px', color: '#555' }}>
        /creditCommittee2024
      </div>
    </div>
  );
}
