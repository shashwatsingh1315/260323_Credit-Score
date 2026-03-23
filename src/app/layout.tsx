import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CreditFlow — Credit Issuance System',
  description: 'Internal credit-issuance and scoring application.',
};

import Shell from '@/components/Shell';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
