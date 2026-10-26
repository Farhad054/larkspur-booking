import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { isAdmin, isAdminConfigured } from "@/lib/admin-auth";
import { ADMIN_PAGE_SIZE, listBookings } from "@/lib/bookings";
import { formatDay, formatPrice, formatRange } from "@/lib/format";
import { adminFiltersSchema, firstParam } from "@/lib/schemas";
import { cancelBookingAction, logoutAction } from "./actions";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: Props) {
  if (!(await isAdmin())) {
    return (
      <div className="mx-auto max-w-md px-5 py-16">
        <h1 className="text-3xl">Admin sign in</h1>
        <p className="mt-2 text-ink-soft">
          Enter the admin password to manage bookings.
        </p>
        <LoginForm configured={isAdminConfigured()} />
      </div>
    );
  }

  const sp = await searchParams;
  const parsed = adminFiltersSchema.safeParse({
    status: firstParam(sp.status) || undefined,
    from: firstParam(sp.from) || undefined,
    to: firstParam(sp.to) || undefined,
    q: firstParam(sp.q) || undefined,
  });
  const filters = parsed.success ? parsed.data : adminFiltersSchema.parse({});
  const { rows, total } = await listBookings(filters);
  const filtered = Boolean(
    filters.q || filters.from || filters.to || filters.status !== "ALL",
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Bookings</h1>
        <form action={logoutAction}>
          <button className="btn btn-outline" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <form
        method="get"
        role="search"
        aria-label="Filter bookings"
        className="mt-6 grid gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_8rem_11rem_11rem_auto]"
      >
        <div>
          <label htmlFor="q" className="mb-1 block text-sm font-semibold">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Name, email or reference"
            className="field"
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-semibold">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status}
            className="field"
          >
            <option value="ALL">All</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div>
          <label htmlFor="from" className="mb-1 block text-sm font-semibold">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={filters.from}
            className="field"
          />
        </div>
        <div>
          <label htmlFor="to" className="mb-1 block text-sm font-semibold">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={filters.to}
            className="field"
          />
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="btn btn-primary">
            Filter
          </button>
          {filtered && (
            <Link prefetch={false} href="/admin" className="btn btn-outline">
              Reset
            </Link>
          )}
        </div>
      </form>

      <p className="mt-5 text-sm text-ink-soft" role="status">
        {total === 0
          ? "No bookings match."
          : `Showing ${rows.length} of ${total} booking${total === 1 ? "" : "s"}${total > ADMIN_PAGE_SIZE ? " (narrow the filters to see the rest)" : ""}.`}
      </p>

      <ul className="mt-3 grid gap-3" aria-label="Bookings">
        {rows.map((b) => {
          const cancelled = b.status === "CANCELLED";
          return (
            <li
              key={b.id}
              data-testid="booking-row"
              data-status={b.status}
              className="grid gap-3 rounded-2xl border border-line bg-card p-4 md:grid-cols-[1.2fr_1.3fr_1fr_7.5rem] md:items-center"
            >
              <div>
                <p className="font-semibold">{b.customerName}</p>
                <p className="break-all text-sm text-ink-soft">
                  {b.customerEmail}
                </p>
                <p className="mt-1 font-mono text-xs tracking-wider text-ink-soft">
                  {b.reference}
                </p>
              </div>
              <div>
                <p className="font-semibold">{b.service.name}</p>
                <p className="text-sm text-ink-soft">
                  {formatDay(b.startsAt)}
                  <br />
                  {formatRange(b.startsAt, b.endsAt)}
                </p>
              </div>
              <div className="flex items-center gap-3 md:flex-col md:items-start">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${cancelled ? "bg-bad-tint text-bad" : "bg-ok-tint text-ok"}`}
                >
                  {cancelled ? "Cancelled" : "Confirmed"}
                </span>
                <span className="text-sm text-ink-soft">
                  {formatPrice(b.service.priceCents)}
                </span>
              </div>
              <div>
                {!cancelled && (
                  <details className="group">
                    <summary className="btn btn-outline cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      Cancel
                      <span className="sr-only"> booking {b.reference}</span>
                    </summary>
                    <form action={cancelBookingAction} className="mt-2">
                      <input type="hidden" name="id" value={b.id} />
                      <button type="submit" className="btn btn-danger w-full">
                        Confirm cancel
                        <span className="sr-only"> {b.reference}</span>
                      </button>
                    </form>
                  </details>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
