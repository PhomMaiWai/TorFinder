import { CtaSection } from "@/components/landing/cta-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { PreviewSection } from "@/components/landing/preview-section";
import { StatsBar } from "@/components/landing/stats-bar";
import { StepsSection } from "@/components/landing/steps-section";
import { TorMatchExplorer } from "@/components/landing/tor-match-explorer";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";

/** Guests only: proxy.ts sends signed-in visitors to their own home. */
export default function LandingPage() {
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
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
