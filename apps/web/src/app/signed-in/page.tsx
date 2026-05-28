import Link from "next/link";
import { I } from "@/components/marketing/_p/Icons";

export const metadata = { title: "Signed in — uatchit" };

export default function SignedInPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <I.Logo width={40} height={40} />
      <h1 className="text-[clamp(28px,4vw,42px)] font-medium tracking-[-0.03em] leading-[1.05] mt-6">
        You&apos;re signed in.
      </h1>
      <p className="text-text-muted mt-4 max-w-md">
        Head back to the <span className="text-text">uatchit</span> side panel to pick up
        where you left off — it&apos;ll refresh on its own.
      </p>
      <Link
        href="/app"
        className="mt-8 rounded-md bg-white text-bg-1 px-4 py-2 text-sm font-medium"
      >
        Open the dashboard instead
      </Link>
    </main>
  );
}
