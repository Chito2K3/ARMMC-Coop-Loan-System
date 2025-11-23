# **App Name**: ARMMC Loan Manager

## Core Features:

- Create Loan Application: Create a new loan application with fields for applicant name, loan amount, and optional remarks.
- Edit Loan Application: Modify any field within an existing loan application, including applicant details, loan status, and approval flags.
- Approval Workflow: Update fields indicating bookkeeping and payroll checks, input applicant's salary, and approve or deny the loan application with optional denial remarks. 
- Dashboard View: List all loan applications, filter by status (pending, approved, denied, released), and sort by creation or update timestamps.
- Loan Detail View: Show all loan application fields, enable full editing, and provide action buttons for approving, denying, and marking the application as checked.
- AI-Powered Risk Assessment Tool: Generates an estimated risk score for each applicant, as well as suggests relevant concerns related to approval, incorporating factors such as loan amount requested, salary and denial history if available. The LLM acts as a tool and might incorporate a specific piece of information.
- Firestore Integration: Use Firestore to store and manage loan application data, including creation, modification, and retrieval.

## Style Guidelines:

- Primary color: Dark Blue (#3F51B5) for a professional and trustworthy feel.
- Background color: Light Gray (#E8EAF6), a desaturated version of the primary, for a clean, professional background.
- Accent color: Purple (#7E57C2), to provide visual interest without being distracting.
- Body and headline font: 'Inter', a sans-serif font for clear readability and a modern look.
- Use simple, consistent icons to represent different loan statuses and actions.
- Maintain a clean and organized layout with clear sections for loan details and actions.
- Use subtle transitions for actions like opening loan details or updating statuses.