import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Maya — AI Restaurant Receptionist',
  description: 'Interactive AI restaurant receptionist demo.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}