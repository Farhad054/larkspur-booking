import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { execSync } from "node:child_process";

// Integration tests run against a real Postgres (TEST_DATABASE_URL, or DATABASE_URL in CI).
const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url)
  throw new Error(
    "Set TEST_DATABASE_URL (or DATABASE_URL) to run integration tests",
  );
process.env.DATABASE_URL = url;

const { db } = await import("@/lib/db");
const {
  cancelBooking,
  createBooking,
  getSlotsForDay,
  isOverlapViolation,
  listBookings,
} = await import("@/lib/bookings");

const NOW = new Date("2026-11-02T12:00:00Z"); // Mon 7:00 am New York
const MON = "2026-11-02";
const form = (over: Record<string, unknown> = {}) => ({
  serviceSlug: "maths-60",
  start: "2026-11-03T15:00:00.000Z", // Tue 10:00 local
  name: "Test Parent",
  email: "parent@example.com",
  ...over,
});

beforeAll(async () => {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
  await db.booking.deleteMany();
  await db.service.deleteMany();
  await db.service.createMany({
    data: [
      {
        slug: "maths-60",
        name: "Maths",
        description: "d",
        durationMin: 60,
        priceCents: 5500,
        sortOrder: 1,
      },
      {
        slug: "intro-30",
        name: "Intro",
        description: "d",
        durationMin: 30,
        priceCents: 0,
        sortOrder: 2,
      },
      {
        slug: "retired",
        name: "Retired",
        description: "d",
        durationMin: 60,
        priceCents: 1,
        active: false,
        sortOrder: 3,
      },
    ],
  });
});
beforeEach(() => db.booking.deleteMany());
afterAll(() => db.$disconnect());

describe("createBooking", () => {
  it("creates a booking with the right end time and a reference", async () => {
    const r = await createBooking(form(), NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.booking.reference).toMatch(/^[A-Z2-9]{8}$/);
      expect(r.booking.endsAt.toISOString()).toBe("2026-11-03T16:00:00.000Z");
      expect(r.booking.status).toBe("CONFIRMED");
    }
  });

  it("rejects an unknown or inactive service", async () => {
    expect(await createBooking(form({ serviceSlug: "nope" }), NOW)).toEqual({
      ok: false,
      code: "SERVICE_NOT_FOUND",
    });
    expect(await createBooking(form({ serviceSlug: "retired" }), NOW)).toEqual({
      ok: false,
      code: "SERVICE_NOT_FOUND",
    });
  });

  it("rejects times that are never offered (off-grid, closed, past)", async () => {
    expect(
      (await createBooking(form({ start: "2026-11-03T15:15:00.000Z" }), NOW))
        .ok,
    ).toBe(false);
    expect(
      await createBooking(form({ start: "2026-11-08T15:00:00.000Z" }), NOW),
    ).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" }); // Sunday
    expect(
      await createBooking(form({ start: "2026-10-30T15:00:00.000Z" }), NOW),
    ).toEqual({ ok: false, code: "SLOT_UNAVAILABLE" }); // past
  });

  it("reports SLOT_TAKEN for an overlapping booking, but allows back-to-back", async () => {
    expect((await createBooking(form(), NOW)).ok).toBe(true); // 10:00–11:00
    expect(
      await createBooking(
        form({ serviceSlug: "intro-30", start: "2026-11-03T15:30:00.000Z" }),
        NOW,
      ),
    ).toEqual({ ok: false, code: "SLOT_TAKEN" });
    expect(
      (await createBooking(form({ start: "2026-11-03T16:00:00.000Z" }), NOW))
        .ok,
    ).toBe(true); // 11:00–12:00
    expect(
      (
        await createBooking(
          form({ serviceSlug: "intro-30", start: "2026-11-03T14:30:00.000Z" }),
          NOW,
        )
      ).ok,
    ).toBe(true); // 9:30–10:00
  });

  it("lets exactly one of many simultaneous requests win (database constraint)", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        createBooking(form({ email: `p${i}@example.com` }), NOW),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(
      results.filter((r) => !r.ok && r.code === "SLOT_TAKEN"),
    ).toHaveLength(7);
    expect(await db.booking.count()).toBe(1);
  });

  it("still reports SLOT_TAKEN when the availability read is stale (constraint is the backstop)", async () => {
    expect((await createBooking(form(), NOW)).ok).toBe(true);
    // Simulate losing a race: this request's availability check sees no bookings.
    const spy = vi.spyOn(db.booking, "findMany").mockResolvedValueOnce([]);
    const r = await createBooking(form({ email: "late@example.com" }), NOW);
    expect(spy).toHaveBeenCalled();
    expect(r).toEqual({ ok: false, code: "SLOT_TAKEN" });
    spy.mockRestore();
    expect(await db.booking.count()).toBe(1);
  });

  it("the exclusion constraint itself blocks overlapping inserts that bypass the app check", async () => {
    const svc = await db.service.findFirstOrThrow({
      where: { slug: "maths-60" },
    });
    const base = {
      serviceId: svc.id,
      customerName: "x",
      customerEmail: "x@example.com",
    };
    await db.booking.create({
      data: {
        ...base,
        reference: "AAAAAAAA",
        startsAt: new Date("2026-11-03T15:00:00Z"),
        endsAt: new Date("2026-11-03T16:00:00Z"),
      },
    });
    const err = await db.booking
      .create({
        data: {
          ...base,
          reference: "BBBBBBBB",
          startsAt: new Date("2026-11-03T15:30:00Z"),
          endsAt: new Date("2026-11-03T16:30:00Z"),
        },
      })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(err).not.toBeNull();
    expect(isOverlapViolation(err)).toBe(true); // the real Postgres error is recognised as an overlap
    await expect(
      db.booking.create({
        data: {
          ...base,
          reference: "CCCCCCCC",
          startsAt: new Date("2026-11-03T17:00:00Z"),
          endsAt: new Date("2026-11-03T17:00:00Z"),
        },
      }),
    ).rejects.toThrow(); // zero-length violates CHECK
  });
});

describe("cancelling", () => {
  it("frees the slot for a new booking", async () => {
    const r = await createBooking(form(), NOW);
    if (!r.ok) throw new Error("setup");
    expect(
      (await getSlotsForDay(60, "2026-11-03", NOW)).map((s) => s.label),
    ).not.toContain("10:00 AM");
    const cancelled = await cancelBooking(r.booking.id);
    expect(cancelled?.status).toBe("CANCELLED");
    expect(cancelled?.cancelledAt).toBeInstanceOf(Date);
    expect(
      (await getSlotsForDay(60, "2026-11-03", NOW)).map((s) => s.label),
    ).toContain("10:00 AM");
    expect(
      (await createBooking(form({ email: "new@example.com" }), NOW)).ok,
    ).toBe(true);
  });

  it("returns null when cancelling twice or an unknown id", async () => {
    const r = await createBooking(form(), NOW);
    if (!r.ok) throw new Error("setup");
    await cancelBooking(r.booking.id);
    expect(await cancelBooking(r.booking.id)).toBeNull();
    expect(await cancelBooking("does-not-exist")).toBeNull();
  });
});

describe("getSlotsForDay and listBookings", () => {
  it("hides booked times from availability", async () => {
    await createBooking(form({ start: "2026-11-02T15:00:00.000Z" }), NOW); // Mon 10:00
    const labels = (await getSlotsForDay(60, MON, NOW)).map((s) => s.label);
    expect(labels).not.toContain("10:00 AM");
    expect(labels).toContain("11:00 AM");
  });

  it("filters by status, date range and search text", async () => {
    const a = await createBooking(
      form({ name: "Alice Adams", email: "alice@example.com" }),
      NOW,
    );
    await createBooking(
      form({
        name: "Bob Brown",
        email: "bob@example.com",
        start: "2026-11-04T15:00:00.000Z",
      }),
      NOW,
    );
    if (!a.ok) throw new Error("setup");
    await cancelBooking(a.booking.id);

    expect((await listBookings({ status: "ALL" })).total).toBe(2);
    expect(
      (await listBookings({ status: "CANCELLED" })).rows.map(
        (r) => r.customerName,
      ),
    ).toEqual(["Alice Adams"]);
    expect(
      (await listBookings({ status: "CONFIRMED" })).rows.map(
        (r) => r.customerName,
      ),
    ).toEqual(["Bob Brown"]);
    expect(
      (
        await listBookings({
          status: "ALL",
          from: "2026-11-04",
          to: "2026-11-04",
        })
      ).rows,
    ).toHaveLength(1);
    expect(
      (await listBookings({ status: "ALL", q: "ALICE@" })).rows,
    ).toHaveLength(1);
    expect(
      (
        await listBookings({
          status: "ALL",
          q: a.booking.reference.toLowerCase(),
        })
      ).rows,
    ).toHaveLength(1);
    expect(
      (await listBookings({ status: "ALL", from: "2026-12-01" })).rows,
    ).toHaveLength(0);
  });
});
