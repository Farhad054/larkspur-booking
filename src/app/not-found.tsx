import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-20">
      <h1 className="text-4xl">Page not found</h1>
      <p className="mt-3 text-ink-soft">
        That page doesn&rsquo;t exist, or the booking reference is wrong.
      </p>
      <Link href="/" className="btn btn-primary mt-6">
        Back to home
      </Link>
    </div>
  );
}
