import { asc, desc, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, messages } from '@/db/schema';

function summarizeTitle(content?: string | null) {
  const text = content?.trim() ?? '';
  return text ? text.slice(0, 48) : 'New chat';
}

function summarizePreview(content?: string | null) {
  const text = content?.trim() ?? '';
  return text ? text.slice(0, 72) : 'Start a new conversation';
}

export async function GET() {
  const conversationRows = await db
    .select({
      id: conversations.id,
      updatedAt: conversations.updatedAt,
    })
    .from(conversations)
    .orderBy(desc(conversations.updatedAt));

  if (conversationRows.length === 0) {
    return Response.json([]);
  }

  const messageRows = await db
    .select({
      conversationId: messages.conversationId,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(inArray(messages.conversationId, conversationRows.map((row) => row.id)))
    .orderBy(asc(messages.createdAt));

  const messagesByConversation = new Map<string, typeof messageRows>();

  for (const row of messageRows) {
    const currentRows = messagesByConversation.get(row.conversationId) ?? [];
    currentRows.push(row);
    messagesByConversation.set(row.conversationId, currentRows);
  }

  return Response.json(
    conversationRows.map((conversation) => {
      const conversationMessages = messagesByConversation.get(conversation.id) ?? [];
      const firstUserMessage = conversationMessages.find((message) => message.role === 'user');
      const lastMessage = conversationMessages.at(-1);

      return {
        id: conversation.id,
        title: summarizeTitle(firstUserMessage?.content),
        preview: summarizePreview(lastMessage?.content),
        updatedAt: conversation.updatedAt.toISOString(),
      };
    }),
  );
}

export async function POST() {
  const [conversation] = await db
    .insert(conversations)
    .values({})
    .returning({
      id: conversations.id,
      updatedAt: conversations.updatedAt,
    });

  return Response.json({
    id: conversation.id,
    title: 'New chat',
    preview: 'Start a new conversation',
    updatedAt: conversation.updatedAt.toISOString(),
  });
}
