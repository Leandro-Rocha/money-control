import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

import { cookies } from "next/headers";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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

  return (
    <html
      lang="pt-BR"
      className={cn("font-sans", geist.variable, isPrivate && "privacy-active")}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(document.cookie.indexOf('money_control_privacy_active=true')!==-1||sessionStorage.getItem('money_control_privacy_active')==='true'){document.documentElement.classList.add('privacy-active');}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
