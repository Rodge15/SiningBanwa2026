export function Alert({ tone = "error", children }) {
  if (!children) {
    return null;
  }

  const className =
    tone === "success"
      ? "mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900"
      : "mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900";

  return <p className={className}>{children}</p>;
}
