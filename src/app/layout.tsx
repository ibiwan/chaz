import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chaz Full-Stack Starter',
  description: 'Frontend + backend TypeScript starter for Vercel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
