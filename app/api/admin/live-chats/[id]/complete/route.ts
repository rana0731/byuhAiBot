import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { liveChats } from '@/db/schema';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  await db
    .update(liveChats)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(eq(liveChats.id, id));

  return Response.json({ success: true });
}