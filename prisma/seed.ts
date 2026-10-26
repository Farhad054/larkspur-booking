import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { DateTime } from "luxon";
import { PrismaClient } from "../src/generated/prisma/client";
import { BUSINESS } from "../src/lib/config";
import { getAvailableSlots } from "../src/lib/slots";
import { newReference } from "../src/lib/reference";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const SERVICES = [
  { slug: "intro-chat", name: "Free intro chat", description: "A relaxed 30-minute call to talk through goals, current grades and what support would help most.", durationMin: 30, priceCents: 0, sortOrder: 1 },
  { slug: "maths-60", name: "Maths tutoring", description: "Grades 6–12: algebra, geometry, pre-calculus and calculus, with worked examples and practice.", durationMin: 60, priceCents: 5500, sortOrder: 2 },
  { slug: "writing-60", name: "Writing & essay coaching", description: "Structure, argument and clarity for essays, personal statements and lab reports.", durationMin: 60, priceCents: 5500, sortOrder: 3 },
  { slug: "test-prep-90", name: "Test prep intensive", description: "A focused 90-minute session on SAT/ACT-style problems, pacing and exam strategy.", durationMin: 90, priceCents: 8000, sortOrder: 4 },
  { slug: "study-skills-60", name: "Study skills workshop", description: "Planning, note-taking and revision habits that make homework less stressful.", durationMin: 60, priceCents: 4500, sortOrder: 5 },
  { slug: "parent-checkin-30", name: "Parent progress check-in", description: "A short call to review progress and agree next steps. For parents and guardians.", durationMin: 30, priceCents: 2500, sortOrder: 6 },
];

// Fictional people, example.com addresses only.
const PEOPLE = [
  ["Priya Raman", "priya.raman@example.com"],
  ["Marcus Bell", "marcus.bell@example.com"],
  ["Elena Fischer", "elena.fischer@example.com"],
  ["Tomás Herrera", "tomas.herrera@example.com"],
  ["Aisha Okafor", "aisha.okafor@example.com"],
  ["Daniel Kim", "daniel.kim@example.com"],
  ["Sofia Lindqvist", "sofia.lindqvist@example.com"],
  ["Noah Whitfield", "noah.whitfield@example.com"],
  ["Hannah Cho", "hannah.cho@example.com"],
  ["Leo Marchetti", "leo.marchetti@example.com"],
] as const;

const NOTES = [
  "Struggling with quadratics before the unit test.",
  "Preparing for the March SAT.",
  "First time with online tutoring.",
  "Needs help structuring a history essay.",
  null,
  null,
  "Prefers worked examples over theory.",
];

// Small deterministic PRNG so repeated seeds produce the same layout.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

async function main() {
  const rand = rng(42);
  await db.booking.deleteMany();
  for (const s of SERVICES) await db.service.upsert({ where: { slug: s.slug }, update: s, create: s });
  const services = await db.service.findMany();

  const now = new Date();
  const today = DateTime.fromJSDate(now, { zone: BUSINESS.timeZone }).startOf("day");
  const taken: { start: Date; end: Date }[] = [];
  let created = 0;
  let cancelled = 0;

  // Bookings across the next ~3 weeks, each picked from slots that are genuinely open.
  for (let d = 0; d < 21; d++) {
    const date = today.plus({ days: d }).toISODate()!;
    const perDay = Math.floor(rand() * 4); // 0–3
    for (let i = 0; i < perDay; i++) {
      const svc = services[Math.floor(rand() * services.length)];
      const open = getAvailableSlots({ date, durationMin: svc.durationMin, now, booked: taken, config: BUSINESS });
      if (!open.length) continue;
      const slot = open[Math.floor(rand() * open.length)];
      const [name, email] = PEOPLE[Math.floor(rand() * PEOPLE.length)];
      const isCancelled = rand() < 0.15;
      await db.booking.create({
        data: {
          reference: newReference(),
          serviceId: svc.id,
          startsAt: new Date(slot.start),
          endsAt: new Date(slot.end),
          customerName: name,
          customerEmail: email,
          notes: NOTES[Math.floor(rand() * NOTES.length)],
          status: isCancelled ? "CANCELLED" : "CONFIRMED",
          cancelledAt: isCancelled ? now : null,
        },
      });
      if (isCancelled) cancelled++;
      else taken.push({ start: new Date(slot.start), end: new Date(slot.end) });
      created++;
    }
  }
  console.log(`Seeded ${services.length} services and ${created} bookings (${cancelled} cancelled).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
