import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBookingByReference } from "@/lib/bookings";
import { isEmailConfigured } from "@/lib/email";
import {
  formatDay,
  formatDuration,
  formatPrice,
  formatRange,
} from "@/lib/format";
import { referenceSchema } from "@/lib/schemas";

export const metadata: Metadata = {
  title: "Booking confirmed",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const ref = referenceSchema.safeParse(reference);
  if (!ref.success) notFound();
  const booking = await getBookingByReference(ref.data);
  if (!booking) notFound();
  const cancelled = booking.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div
        className={`rounded-2xl p-6 ${cancelled ? "bg-bad-tint text-bad" : "bg-ok-tint text-ok"}`}
        role="status"
      >
        <h1 className="text-3xl">
          {cancelled ? "This booking was cancelled" : "You’re booked!"}
        </h1>
        <p className="mt-1">
          Reference{" "}
          <strong
            data-testid="reference"
            className="font-mono text-lg tracking-wider"
          >
            {booking.reference}
          </strong>
        </p>
      </div>

      <dl className="mt-6 grid gap-3 rounded-2xl border border-line bg-card p-5">
        <Row
          label="Service"
          value={`${booking.service.name} · ${formatDuration(booking.service.durationMin)}`}
        />
        <Row label="Date" value={formatDay(booking.startsAt)} />
        <Row
          label="Time"
          value={formatRange(booking.startsAt, booking.endsAt)}
        />
        <Row label="Name" value={booking.customerName} />
        <Row label="Email" value={booking.customerEmail} />
        <Row label="Price" value={formatPrice(booking.service.priceCents)} />
      </dl>

      {!cancelled && (
        <p className="mt-4 text-sm text-ink-soft">
          {isEmailConfigured()
            ? `A confirmation was emailed to ${booking.customerEmail}.`
            : "Email is switched off in this demo, so no confirmation was sent. Keep your reference."}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {!cancelled && (
          <a
            href={`/booking/${booking.reference}/calendar.ics`}
            className="btn btn-outline"
          >
            Add to calendar
          </a>
        )}
        <Link prefetch={false} href="/book" className="btn btn-primary">
          Book another session
        </Link>
      </div>
      <p className="mt-6 text-sm text-ink-soft">
        Sample project: nothing here is a real appointment.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
