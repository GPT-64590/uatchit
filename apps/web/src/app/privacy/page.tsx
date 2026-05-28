import { LiveNav } from "@/components/marketing/LiveNav";
import { Footer } from "@/components/marketing/Footer";

export const metadata = { title: "Privacy — uatchit" };

export default function Privacy() {
  return (
    <>
      <LiveNav />
      <main className="pt-32 pb-24 px-6 max-w-2xl mx-auto">
        <h1 className="text-[clamp(40px,5.6vw,72px)] font-medium tracking-[-0.03em] leading-[1.02] mb-3">
          Privacy.
        </h1>
        <p className="text-text-muted text-sm">Last updated: 2026-05-26</p>

        <h2 className="text-xl font-medium mt-10 mb-3">What we collect</h2>
        <ul className="text-text-muted text-sm space-y-1 list-disc pl-6">
          <li>
            <strong>Account data:</strong> email address (for sign-in via magic link).
          </li>
          <li>
            <strong>Watch data:</strong> URLs you choose to watch, AI-inferred schemas, snapshots of
            the public pages we fetch on your behalf.
          </li>
          <li>
            <strong>Usage data:</strong> minimal server logs, no analytics SDK, no tracking pixels.
          </li>
        </ul>

        <h2 className="text-xl font-medium mt-10 mb-3">What we do NOT collect</h2>
        <ul className="text-text-muted text-sm space-y-1 list-disc pl-6">
          <li>Your browsing history.</li>
          <li>Anything outside the pages you explicitly choose to watch.</li>
          <li>
            Logged-in or personalized content — uatchit fetches anonymously via proxies.
          </li>
        </ul>

        <h2 className="text-xl font-medium mt-10 mb-3">Chrome extension permissions</h2>
        <p className="text-text-muted text-sm">
          The extension requests{" "}
          <code className="font-mono text-accent">{"<all_urls>"}</code> host access. This is
          required so the right-click menu works on any page you visit. We only read page content
          when you explicitly invoke uatchit (right-click → Watch). We never read pages in the
          background.
        </p>

        <h2 className="text-xl font-medium mt-10 mb-3">Email</h2>
        <p className="text-text-muted text-sm">
          We send transactional emails (sign-in links, change notifications) via Resend. We
          don&apos;t send marketing email without opt-in.
        </p>

        <h2 className="text-xl font-medium mt-10 mb-3">Data deletion</h2>
        <p className="text-text-muted text-sm">
          Email{" "}
          <a href="mailto:privacy@uatchit.com" className="text-accent">
            privacy@uatchit.com
          </a>{" "}
          and we&apos;ll delete your account and all watches within 7 days.
        </p>
      </main>
      <Footer />
    </>
  );
}
