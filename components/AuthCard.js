import Link from "next/link";

export function AuthCard({ title, description, children }) {
  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-sm">
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-brand hover:underline">
        <span aria-hidden="true">&larr;</span> Back to home
      </Link>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description ? <p className="mt-2 text-sm leading-6 text-muted">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}