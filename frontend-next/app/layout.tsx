import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Robot Control — Cobot 320',
  description: 'Panel de control industrial para brazos Elephant Robotics Cobot 320',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="bg-bg-secondary font-sans text-[13px] text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
