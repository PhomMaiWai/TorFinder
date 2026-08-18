import { CtaSection } from "@/components/landing/cta-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { PreviewSection } from "@/components/landing/preview-section";
import { StatsBar } from "@/components/landing/stats-bar";
import { StepsSection } from "@/components/landing/steps-section";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNavbar } from "@/components/layout/site-navbar";

export default function LandingPage() {
  return (
    <>
      <SiteNavbar />
      <main>
        <HeroSection />
        <StatsBar />
        <PreviewSection />
        <FeaturesSection />
        <StepsSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </>
  );
}
