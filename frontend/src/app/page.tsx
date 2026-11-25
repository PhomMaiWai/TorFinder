import { CtaSection } from "@/components/landing/cta-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { PreviewSection } from "@/components/landing/preview-section";
import { StatsBar } from "@/components/landing/stats-bar";
import { StepsSection } from "@/components/landing/steps-section";
import { TorMatchExplorer } from "@/components/landing/tor-match-explorer";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { getLandingData } from "@/lib/landing-data";

/** Guests only: proxy.ts sends signed-in visitors to their own home. */
export default async function LandingPage() {
  // The figures and the preview come from the database, never from the copy.
  const { stats, previews } = await getLandingData();

  return (
    <>
      <SiteNavbar />
      <main>
        <HeroSection />
        <StatsBar stats={stats} />
        <TorMatchExplorer />
        <PreviewSection tors={previews} />
        <FeaturesSection />
        <StepsSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
