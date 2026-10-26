import type { Metadata } from "next";
import Link from "next/link";
import { BookingForm } from "@/components/booking-form";
import { getServiceBySlug, getSlotsForDay } from "@/lib/bookings";
import {
  formatDay,
  formatDuration,
  formatPrice,
  formatRange,
} from "@/lib/format";
import { firstParam, slugSchema } from "@/lib/schemas";
import { BUSINESS } from "@/lib/config";
import { DateTime } from "luxon";
import { z } from "zod";

export const metadata: Metadata = {
  title: "Your details",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function Unavailable({ slug }: { slug?: string }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <h1 className="text-3xl">That time isn&rsquo;t available</h1>
      <p className="mt-3 text-ink-soft">
        It may have just been booked, or the link is out of date.
      </p>
      <Link
        href={slug ? `/book?service=${slug}` : "/book"}
        className="btn btn-primary mt-6"
      >
        Choose another time
      </Link>
    </div>
  );
}

export default async function DetailsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const slug = slugSchema.safeParse(firstParam(sp.service));
  const startParse = z.iso.datetime().safeParse(firstParam(sp.start));
  if (!slug.success || !startParse.success) return <Unavailable />;

  const service = await getServiceBySlug(slug.data);
  if (!service) return <Unavailable />;

  const start = new Date(startParse.data);
  const date = DateTime.fromJSDate(start, {
    zone: BUSINESS.timeZone,
  }).toISODate()!;
  const stillOpen = (await getSlotsForDay(service.durationMin, date)).some(
    (s) => s.start === start.toISOString(),
  );
  if (!stillOpen) return <Unavailable slug={service.slug} />;

  const end = new Date(start.getTime() + service.durationMin * 60_000);
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl sm:text-4xl">Your details</h1>
      <dl className="mt-6 grid gap-1 rounded-2xl border border-line bg-card p-5">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-soft">Service</dt>
          <dd className="font-semibold">
            {service.name} · {formatDuration(service.durationMin)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-soft">When</dt>
          <dd className="text-right font-semibold">
            {formatDay(start)}
            <br />
            {formatRange(start, end)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-soft">Price</dt>
          <dd className="font-semibold">{formatPrice(service.priceCents)}</dd>
        </div>
      </dl>
      <div className="mt-8">
        <BookingForm serviceSlug={service.slug} start={start.toISOString()} />
      </div>
    </div>
  );
}
