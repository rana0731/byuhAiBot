import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { liveChats, messages } from '@/db/schema';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { action } = await req.json();

  if (action === 'accept') {
    await db
      .update(liveChats)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(liveChats.id, id));

    return Response.json({ success: true });
  }

  if (action === 'complete') {
    await db
      .update(liveChats)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(liveChats.id, id));

    return Response.json({ success: true });
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 });
}