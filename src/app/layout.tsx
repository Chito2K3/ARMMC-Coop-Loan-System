import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthGuard } from '@/components/auth-guard';
import { DashboardLayout } from '@/components/dashboard-layout';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'ARMMC Loan Manager',
  description: 'An internal tool for managing cooperative loan applications.',
  icons: {
    icon: [{ url: '/logo.png', sizes: '32x32', type: 'image/png' }],
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body suppressHydrationWarning className="font-body antialiased min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background">
        <FirebaseClientProvider>
          <AuthGuard>
            <DashboardLayout>
              {children}
            </DashboardLayout>
          </AuthGuard>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
