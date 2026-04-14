import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, messages } from '@/db/schema';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const conversation = await db.query.conversations.findFirst({
    where: eq(conversations.id, id),
  });

  if (!conversation) {
    return new Response('Conversation not found.', { status: 404 });
  }

  const conversationMessages = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
    })
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  return Response.json({
    id,
    messages: conversationMessages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        id: message.id,
        role: message.role,
        parts: [
          {
            type: 'text',
            text: message.content,
          },
        ],
      })),
  });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  await db.delete(conversations).where(eq(conversations.id, id));

  return new Response(null, { status: 204 });
}
