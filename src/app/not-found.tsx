import Link from "next/link";
import { de } from "@/i18n/de";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="text-4xl" aria-hidden>
        🌙
      </p>
      <p className="text-lg font-semibold">{de.errors.notFound}</p>
      <Link href="/heute" className="btn btn-primary w-full">
        {de.tabs.today}
      </Link>
    </main>
  );
}
