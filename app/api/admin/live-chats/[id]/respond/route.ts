import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { liveChats, messages } from '@/db/schema';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { message } = await req.json();

  // Get the conversation ID for this live chat
  const chat = await db
    .select({ conversationId: liveChats.conversationId })
    .from(liveChats)
    .where(eq(liveChats.id, id))
    .limit(1);

  if (!chat.length) {
    return Response.json({ error: 'Live chat not found' }, { status: 404 });
  }

  const conversationId = chat[0].conversationId;

  // Insert the admin response
  await db.insert(messages).values({
    conversationId,
    role: 'assistant',
    content: message,
  });

  // Update the live chat timestamp
  await db
    .update(liveChats)
    .set({ updatedAt: new Date() })
    .where(eq(liveChats.id, id));

  return Response.json({ success: true });
}