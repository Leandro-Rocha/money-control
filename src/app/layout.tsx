import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { cookies } from "next/headers";
import { ACCENT_COOKIE, COUNTUP_COOKIE, MOTION_COOKIE, parseAccent, parseCountUp, parseMotion } from "@/lib/appearance";
import { AppProviders } from "@/components/AppProviders";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Money Control - Gestão Financeira",
  description: "Controle simples e direto de gastos e ganhos",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isPrivate = cookieStore.get("money_control_privacy_active")?.value === "true";
  const accent = parseAccent(cookieStore.get(ACCENT_COOKIE)?.value);
  const motion = parseMotion(cookieStore.get(MOTION_COOKIE)?.value);
  const countUp = parseCountUp(cookieStore.get(COUNTUP_COOKIE)?.value);

  return (
    <html
      lang="pt-BR"
      data-accent={accent}
      className={cn(
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        isPrivate && "privacy-active",
        motion === "off" && "motion-off",
        countUp === "off" && "countup-off",
      )}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-bg text-ink antialiased" suppressHydrationWarning>
        <Script id="privacy-init">
          {`try{if(document.cookie.indexOf('money_control_privacy_active=true')!==-1||sessionStorage.getItem('money_control_privacy_active')==='true'){document.documentElement.classList.add('privacy-active');}}catch(e){}`}
        </Script>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
