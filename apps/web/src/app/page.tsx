import { LiveNav } from "@/components/marketing/LiveNav";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { UseCases } from "@/components/marketing/UseCases";
import { LiveDiff } from "@/components/marketing/LiveDiff";
import { MCPTerminal } from "@/components/marketing/MCPTerminal";
import { PricingSection } from "@/components/marketing/PricingSection";
import { FAQ } from "@/components/marketing/FAQ";
import { CTAStrip } from "@/components/marketing/CTAStrip";
import { Footer } from "@/components/marketing/Footer";

export default function Home() {
  return (
    <>
      <LiveNav />
      <main id="main">
        <Hero />
        <HowItWorks />
        <UseCases />
        <LiveDiff />
        <MCPTerminal />
        <PricingSection />
        <FAQ />
        <CTAStrip />
      </main>
      <Footer />
    </>
  );
}
