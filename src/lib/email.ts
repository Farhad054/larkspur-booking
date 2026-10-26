import { BRAND, SITE_URL } from "./config";
import { formatDay, formatRange } from "./format";

type BookingForEmail = {
  reference: string;
  customerName: string;
  customerEmail: string;
  startsAt: Date;
  endsAt: Date;
  service: { name: string };
};

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

async function send(
  to: string,
  subject: string,
  text: string,
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(
      `[email] RESEND_API_KEY not set; would send "${subject}" to ${to}`,
    );
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? `${BRAND.name} <onboarding@resend.dev>`,
        to: [to],
        subject,
        text,
      }),
    });
    if (!res.ok) console.error(`[email] Resend responded ${res.status}`);
    return res.ok;
  } catch (err) {
    console.error(
      "[email] send failed",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

const when = (b: BookingForEmail) =>
  `${formatDay(b.startsAt)}, ${formatRange(b.startsAt, b.endsAt)}`;

export function sendConfirmation(b: BookingForEmail) {
  return send(
    b.customerEmail,
    `Booking confirmed: ${b.service.name}`,
    `Hi ${b.customerName},\n\nYour session is confirmed.\n\n${b.service.name}\n${when(b)}\nReference: ${b.reference}\n\nDetails: ${SITE_URL}/booking/${b.reference}\n\nThis is a sample project; ${BRAND.name} is fictional.`,
  );
}

export function sendCancellation(b: BookingForEmail) {
  return send(
    b.customerEmail,
    `Booking cancelled: ${b.service.name}`,
    `Hi ${b.customerName},\n\nYour session on ${when(b)} (reference ${b.reference}) has been cancelled.\n\nYou can book a new time at ${SITE_URL}/book.`,
  );
}
