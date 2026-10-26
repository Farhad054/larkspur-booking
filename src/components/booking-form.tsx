"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createBookingAction, type BookingFormState } from "@/app/actions";

export function BookingForm({
  serviceSlug,
  start,
}: {
  serviceSlug: string;
  start: string;
}) {
  const [state, action, pending] = useActionState<BookingFormState, FormData>(
    createBookingAction,
    {},
  );
  const fe = state.fieldErrors ?? {};
  const f = (name: "name" | "email" | "notes") => ({
    name,
    id: name,
    className: "field",
    "aria-invalid": fe[name] ? (true as const) : undefined,
    "aria-describedby": fe[name] ? `${name}-error` : undefined,
  });
  const err = (name: "name" | "email" | "notes") =>
    fe[name] ? (
      <p id={`${name}-error`} className="field-error">
        {fe[name]}
      </p>
    ) : null;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="serviceSlug" value={serviceSlug} />
      <input type="hidden" name="start" value={start} />
      <div>
        <label htmlFor="name" className="mb-1 block font-semibold">
          Your name
        </label>
        <input type="text" autoComplete="name" required {...f("name")} />
        {err("name")}
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block font-semibold">
          Email
        </label>
        <input type="email" autoComplete="email" required {...f("email")} />
        {err("email")}
      </div>
      <div>
        <label htmlFor="notes" className="mb-1 block font-semibold">
          Anything we should know?{" "}
          <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <textarea rows={4} {...f("notes")} />
        {err("notes")}
      </div>
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="company">Leave this field empty</label>
        <input
          id="company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div role="alert" aria-live="assertive">
        {state.error && (
          <p className="rounded-lg bg-bad-tint p-3 font-semibold text-bad">
            {state.error}{" "}
            {state.slotGone && (
              <Link
                href={`/book?service=${serviceSlug}`}
                className="underline underline-offset-4"
              >
                Choose another time
              </Link>
            )}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
