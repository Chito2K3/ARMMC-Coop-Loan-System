# ARMMC Coop Loan System

A comprehensive Loan Management System designed for the ARMMC Cooperative to streamline loan applications, releases, collections, and risk assessment.

## 🚀 Key Features

*   **Loan Lifecycle Management**: Complete workflow from Application → Approval → Fund Release → Collection → Full Payment.
*   **Smart Computation**:
    *   Automated amortization schedules with **Diminishing Interest** calculation.
    *   Dynamic service fee and capital share deductions.
*   **Collection & Penalty System**:
    *   Real-time monitoring of due payments.
    *   **Automated Penalty Tracking**: Automatically flags overdue payments.
    *   **Dynamic Penalty Settings**: Configurable grace periods and penalty amounts.
    *   **Waive/Defer Options**: Flexible tools for admins to waive or deny (defer) penalties.
*   **Risk Assessment Engine**:
    *   Analyzes borrower's history across all loans.
    *   **Coop-Friendly Risk Alert**:
        *   🟢 **Low Risk**: Clean record.
        *   🟡 **Medium Risk**: 1-2 deferred penalties or minor late payments.
        *   🟠 **High Risk**: 3+ deferred penalties or frequent delinquency.
        *   🔴 **Critical Risk**: Active past due amounts.
*   **Role-Based Access**: Secure access for Admins, Approvers, Bookkeepers, and Payroll checkers.
*   **Interactive Dashboard**: Real-time insights on active loans, total receivables, and pending approvals.

## 🛠️ Tech Stack

*   **Frontend**: [Next.js](https://nextjs.org/) (React Framework)
*   **Database & Auth**: [Firebase](https://firebase.google.com/) (Firestore, Authentication)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
*   **Icons**: Lucide React

## 📦 Getting Started

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/Chito2K3/ARMMC-Coop-Loan-System.git
    cd ARMMC-Coop-Loan-System
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Run the development server**:
    ```bash
    npm run dev
    ```

4.  **Open the app**:
    Navigate to [http://localhost:3000](http://localhost:3000) (or the port shown in your terminal).

## 📝 License

Private proprietary software for ARMMC Cooperative.
