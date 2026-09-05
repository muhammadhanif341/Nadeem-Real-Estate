import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatWidget } from "@/components/ChatWidget";
import { JsonLd } from "@/components/JsonLd";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.fullName} | Find Your Perfect Property`,
    template: `%s | ${siteConfig.fullName}`,
  },
  description: siteConfig.description,
  openGraph: {
    title: siteConfig.fullName,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.fullName,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col overflow-x-hidden">
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "RealEstateAgent",
            name: siteConfig.fullName,
            description: siteConfig.description,
            url: siteConfig.url,
            telephone: siteConfig.phone,
            email: siteConfig.email,
            address: {
              "@type": "PostalAddress",
              streetAddress: siteConfig.address.line1,
              addressLocality: siteConfig.address.line2,
            },
          }}
        />
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <Header />
        <div className="flex-1">{children}</div>
        <Footer />
        <ChatWidget />
      </body>
    </html>
  );
}
