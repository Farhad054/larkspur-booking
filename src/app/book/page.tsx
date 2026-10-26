import type { Metadata } from "next";
import Link from "next/link";
import { DateTime } from "luxon";
import { getSlotsForDay, listServices } from "@/lib/bookings";
import { BUSINESS } from "@/lib/config";
import { formatDuration, formatPrice } from "@/lib/format";
import { dateSchema, firstParam, slugSchema } from "@/lib/schemas";
import { localToday } from "@/lib/slots";

export const metadata: Metadata = {
  title: "Book a session",
  description: "Choose a service, a day and an open time slot.",
};
export const dynamic = "force-dynamic";

const DAYS_SHOWN = 14;

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BookPage({ searchParams }: Props) {
  const sp = await searchParams;
  const services = await listServices();

  const slugParse = slugSchema.safeParse(firstParam(sp.service));
  const service = slugParse.success
    ? services.find((s) => s.slug === slugParse.data)
    : undefined;

  const now = new Date();
  const today = DateTime.fromISO(localToday(now, BUSINESS.timeZone), {
    zone: BUSINESS.timeZone,
  });
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const d = today.plus({ days: i });
    return {
      iso: d.toISODate()!,
      weekday: d.toFormat("ccc"),
      label: d.toFormat("LLL d"),
      open: Boolean(BUSINESS.hours[d.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7]),
    };
  });

  const dateParse = dateSchema.safeParse(firstParam(sp.date));
  const selectedDay = dateParse.success
    ? days.find((d) => d.iso === dateParse.data)
    : undefined;
  const date = selectedDay?.iso ?? days.find((d) => d.open)?.iso;
  const slots =
    service && date ? await getSlotsForDay(service.durationMin, date, now) : [];

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <h1 className="text-3xl sm:text-4xl">Book a session</h1>

      <section aria-labelledby="step-service" className="mt-10">
        <h2 id="step-service" className="text-xl">
          1. Choose a service
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                prefetch={false}
                href={`/book?service=${s.slug}`}
                aria-current={service?.id === s.id ? "true" : undefined}
                className="pick p-4"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{s.name}</span>
                  <span className="shrink-0 font-semibold">
                    {formatPrice(s.priceCents)}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-ink-soft">
                  {formatDuration(s.durationMin)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {service ? (
        <>
          <section aria-labelledby="step-day" className="mt-12">
            <h2 id="step-day" className="text-xl">
              2. Pick a day
            </h2>
            <ul className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {days.map((d) => (
                <li key={d.iso}>
                  {d.open ? (
                    <Link
                      prefetch={false}
                      href={`/book?service=${service.slug}&date=${d.iso}`}
                      aria-current={d.iso === date ? "true" : undefined}
                      className="pick px-2 py-2.5 text-center"
                    >
                      <span className="block text-xs uppercase tracking-wide text-ink-soft">
                        {d.weekday}
                      </span>
                      <span className="block font-semibold">{d.label}</span>
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="pick px-2 py-2.5 text-center"
                    >
                      <span className="block text-xs uppercase tracking-wide text-ink-soft">
                        {d.weekday}
                      </span>
                      <span className="block font-semibold">{d.label}</span>
                      <span className="sr-only">Closed</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="step-time" className="mt-12">
            <h2 id="step-time" className="text-xl">
              3. Pick a time
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              All times are US Eastern (New York) time.
            </p>
            {slots.length ? (
              <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                {slots.map((s) => (
                  <li key={s.start}>
                    <Link
                      prefetch={false}
                      href={`/book/details?service=${service.slug}&start=${encodeURIComponent(s.start)}`}
                      className="pick py-3 text-center font-semibold"
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className="mt-4 rounded-xl border border-line bg-card p-5"
                role="status"
              >
                No open times on this day. Try another day above.
              </p>
            )}
          </section>
        </>
      ) : (
        <p className="mt-10 text-ink-soft">
          Choose a service to see open days and times.
        </p>
      )}
    </div>
  );
}
