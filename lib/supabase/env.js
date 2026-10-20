export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const configured =
    url.startsWith("https://") &&
    !url.includes("your-project-ref") &&
    anonKey.length > 20 &&
    !anonKey.includes("your-anon-key");

  return { url, anonKey, configured };
}
