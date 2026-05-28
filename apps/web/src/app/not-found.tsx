import Link from "next/link";
import { I } from "@/components/marketing/_p/Icons";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <I.Logo width={28} height={28} />
      <h1 className="text-[clamp(40px,5.6vw,72px)] font-medium tracking-[-0.03em] leading-[1.02] mt-6">
        Nothing here.
      </h1>
      <p className="text-text-muted mt-4">
        The page you&apos;re looking for doesn&apos;t exist or was moved.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-md bg-white text-bg-1 px-4 py-2 text-sm font-medium"
      >
        ← back home
      </Link>
    </main>
  );
}
