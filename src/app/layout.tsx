import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { getImpersonationRole } from '@/utils/auth-actions';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CreditFlow — Credit Issuance System',
  description: 'Internal credit-issuance and scoring application.',
};

import Shell from '@/components/Shell';
import { Toaster } from 'sonner';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialActiveRole = await getImpersonationRole();

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <Shell initialActiveRole={initialActiveRole || 'viewer'}>{children}</Shell>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
