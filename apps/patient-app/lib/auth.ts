import { cookies, headers } from 'next/headers';

export async function getUserId(): Promise<string | null> {
  // If you have auth (e.g. NextAuth), return that user id here.
  // Example later: const session = await getServerSession(authOptions); return session?.user?.id ?? null;

  // Dev fallback: read header or cookie; replace once auth lands.
  const h = headers();
  const headerUid = h.get('x-user-id');
  if (headerUid) return headerUid;

  const c = cookies().get('uid')?.value;
  return c ?? null; // null => treat as guest (localStorage)
}
