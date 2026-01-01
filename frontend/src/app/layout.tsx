import type { Metadata } from "next";
import "./globals.css";
import VisualEditsMessenger from "../visual-edits/VisualEditsMessenger";
import ErrorReporter from "@/components/ErrorReporter";
import Script from "next/script";
import localFont from "next/font/local";
import { Toaster } from "sonner";

const stardom = localFont({
  src: "../../public/Stardom_Complete/Stardom_Complete/Fonts/WEB/fonts/Stardom-Regular.woff2",
  variable: "--font-stardom",
});

export const metadata: Metadata = {
  title: "LAKESIDE - Premium Session Studio",
  description: "A Studio Engineered for Live Teaching",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${stardom.variable} antialiased font-stardom`}>
        <ErrorReporter />
        <Script
          src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts//route-messenger.js"
          strategy="afterInteractive"
          data-target-origin="*"
          data-message-type="ROUTE_CHANGE"
          data-include-search-params="true"
          data-only-in-iframe="true"
          data-debug="true"
          data-custom-data='{"appName": "YourApp", "version": "1.0.0", "greeting": "hi"}'
        />
        {children}
        <VisualEditsMessenger />
        <Toaster theme="dark" richColors position="top-center" />
      </body>
    </html>
  );
}
