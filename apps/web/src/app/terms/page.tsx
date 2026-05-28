import { LiveNav } from "@/components/marketing/LiveNav";
import { Footer } from "@/components/marketing/Footer";

export const metadata = { title: "Terms — uatchit" };

export default function Terms() {
  return (
    <>
      <LiveNav />
      <main className="pt-32 pb-24 px-6 max-w-2xl mx-auto">
        <h1 className="text-[clamp(40px,5.6vw,72px)] font-medium tracking-[-0.03em] leading-[1.02] mb-3">
          Terms.
        </h1>
        <p className="text-text-muted text-sm">Last updated: 2026-05-26</p>
        <p className="text-text-muted text-sm mt-8">
          uatchit is provided as-is during the open beta. By using the service you agree to the
          privacy policy. Beta uptime is best-effort. Don&apos;t use uatchit to violate any third
          party&apos;s terms of service or to scrape logged-in content you don&apos;t have rights
          to.
        </p>
        <p className="text-text-muted text-sm mt-4">
          We&apos;ll publish a formal terms document before Pro launches. Questions?{" "}
          <a href="mailto:hi@uatchit.com" className="text-accent">
            hi@uatchit.com
          </a>
          .
        </p>
      </main>
      <Footer />
    </>
  );
}
