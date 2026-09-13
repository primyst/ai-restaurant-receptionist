import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display', weight: ['400', '500', '600'] });
const inter = Inter({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Maya — AI Restaurant Receptionist',
  description: 'Interactive AI restaurant receptionist demo.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${fraunces.variable} ${inter.variable}`}><body>{children}</body></html>;
}
