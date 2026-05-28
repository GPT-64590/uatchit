import Link from "next/link";
import { requireUserId } from "@/lib/auth-helpers";
import { NewWatchForm } from "./NewWatchForm";

export default async function NewWatchPage() {
  await requireUserId();
  return (
    <div className="wd-container">
      <div className="crumbs">
        <Link href="/app">App</Link>
        <span className="crumbs-sep">›</span>
        <span className="crumbs-current">New watch</span>
      </div>
      <div className="new-wrap">
        <NewWatchForm />
      </div>
    </div>
  );
}
