import { cookies } from "next/headers";

import { CtaSection } from "@/components/landing/cta-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { PreviewSection } from "@/components/landing/preview-section";
import { StatsBar } from "@/components/landing/stats-bar";
import { StepsSection } from "@/components/landing/steps-section";
import { TorMatchExplorer } from "@/components/landing/tor-match-explorer";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export default async function LandingPage() {
  // Read on the server so signed-in visitors never see a sign-up button flash.
  const session = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);

  return (
    <>
      <SiteNavbar />
      <main>
        <HeroSection />
        <StatsBar />
        <TorMatchExplorer />
        <PreviewSection />
        <FeaturesSection />
        <StepsSection />
        <CtaSection signedInRole={session?.role ?? null} />
      </main>
      <SiteFooter />
    </>
  );
}
