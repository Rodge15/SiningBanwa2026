import { Alert } from "@/components/Alert";

function firstString(value) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

export async function QueryMessage({ searchParams }) {
  const query = await searchParams;

  return (
    <>
      <Alert>{firstString(query.error)}</Alert>
      <Alert tone="success">{firstString(query.message)}</Alert>
    </>
  );
}
