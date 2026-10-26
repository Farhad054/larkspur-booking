import Link from "next/link";
import { listServices } from "@/lib/bookings";
import { BRAND } from "@/lib/config";
import { formatDuration, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

const STEPS = [
  ["Choose a service", "From a free intro chat to exam prep."],
  ["Pick a day and time", "You only see times that are actually open."],
  [
    "Confirm your details",
    "Instant confirmation page, plus an email if enabled.",
  ],
] as const;

export default async function Home() {
  const services = await listServices();
  return (
    <>
      <section className="bg-ink text-white">
        <div className="on-dark mx-auto max-w-5xl px-5 py-20 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber">
            One-to-one tutoring · online
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl sm:text-6xl">
            {BRAND.tagline}
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">
            Book a maths, writing or test-prep session in under a minute. No
            account, no back-and-forth emails.
          </p>
          <Link
            prefetch={false}
            href="/book"
            className="btn btn-primary mt-8 !bg-amber !text-ink hover:!bg-white"
          >
            Book a session
          </Link>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-3xl">Services</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.id} className="pick flex flex-col p-5">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-xl">{s.name}</h3>
                <p className="shrink-0 font-semibold">
                  {formatPrice(s.priceCents)}
                </p>
              </div>
              <p className="mt-2 flex-1 text-ink-soft">{s.description}</p>
              <p className="mt-3 text-sm text-ink-soft">
                {formatDuration(s.durationMin)}
              </p>
              <Link
                prefetch={false}
                href={`/book?service=${s.slug}`}
                className="btn btn-outline mt-4 self-start"
              >
                Book<span className="sr-only"> {s.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-line bg-card">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="text-3xl">How it works</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-tint font-display font-bold text-indigo-dark">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-lg">{title}</h3>
                <p className="mt-1 text-ink-soft">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
