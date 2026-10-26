import { describe, expect, it } from "vitest";
import {
  adminFiltersSchema,
  bookingFormSchema,
  referenceSchema,
} from "@/lib/schemas";
import { newReference } from "@/lib/reference";

const ok = {
  serviceSlug: "maths-60",
  start: "2026-11-03T15:00:00.000Z",
  name: "Ada Lovelace",
  email: "ADA@Example.com",
};

describe("bookingFormSchema", () => {
  it("accepts valid input and normalises the email", () => {
    const r = bookingFormSchema.parse(ok);
    expect(r.email).toBe("ada@example.com");
  });
  it.each([
    ["short name", { name: "A" }],
    ["bad email", { email: "nope" }],
    ["bad start", { start: "tomorrow" }],
    ["slug with injection chars", { serviceSlug: "x'; drop table" }],
    ["long notes", { notes: "x".repeat(501) }],
    ["filled honeypot", { company: "spam" }],
  ])("rejects %s", (_n, over) => {
    expect(bookingFormSchema.safeParse({ ...ok, ...over }).success).toBe(false);
  });
});

describe("other schemas", () => {
  it("validates references and generated references match", () => {
    for (let i = 0; i < 50; i++)
      expect(referenceSchema.safeParse(newReference()).success).toBe(true);
    expect(referenceSchema.safeParse("abc").success).toBe(false);
    expect(referenceSchema.safeParse("AAAAAAA0").success).toBe(false);
  });
  it("defaults and validates admin filters", () => {
    expect(adminFiltersSchema.parse({}).status).toBe("ALL");
    expect(adminFiltersSchema.safeParse({ status: "DROP" }).success).toBe(
      false,
    );
    expect(adminFiltersSchema.safeParse({ from: "2026-02-30" }).success).toBe(
      false,
    );
  });
});
