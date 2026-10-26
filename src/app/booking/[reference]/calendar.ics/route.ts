import { getBookingByReference } from "@/lib/bookings";
import { BRAND } from "@/lib/config";
import { referenceSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const ref = referenceSchema.safeParse((await params).reference);
  const booking = ref.success ? await getBookingByReference(ref.data) : null;
  if (!booking || booking.status !== "CONFIRMED")
    return new Response("Not found", { status: 404 });

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${BRAND.name}//Sample//EN`,
    "BEGIN:VEVENT",
    `UID:${booking.reference}@larkspur.example`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(booking.startsAt)}`,
    `DTEND:${stamp(booking.endsAt)}`,
    `SUMMARY:${booking.service.name} (${BRAND.name})`,
    `DESCRIPTION:Reference ${booking.reference}. Sample project booking.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${booking.reference}.ics"`,
    },
  });
}
