import { LiveNav } from "@/components/marketing/LiveNav";
import { PricingSection } from "@/components/marketing/PricingSection";
import { FAQ } from "@/components/marketing/FAQ";
import { Footer } from "@/components/marketing/Footer";

export const metadata = {
  title: "Pricing — uatchit",
  description: "Free during beta. $15/mo when we launch. We're proving the product.",
};

export default function Pricing() {
  return (
    <>
      <LiveNav />
      <main className="pt-24">
        <PricingSection />
        <FAQ />
        <Footer />
      </main>
    </>
  );
}
