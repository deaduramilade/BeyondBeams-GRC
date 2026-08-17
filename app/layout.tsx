import type { Metadata } from "next";
import { Manrope, Newsreader } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });
export const metadata: Metadata = { title: { default: "BeyondBeams GRC", template: "%s | BeyondBeams GRC" }, description: "A clear, accountable risk register for modern teams." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><body className={`${manrope.variable} ${newsreader.variable} font-sans`}><ThemeProvider>{children}</ThemeProvider></body></html>; }