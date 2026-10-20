export function AuthCard({ title, description, children }) {
  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description ? <p className="mt-2 text-sm leading-6 text-muted">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
