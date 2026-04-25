import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, liveChats, messages } from '@/db/schema';

export async function GET() {
  const chats = await db
    .select({
      id: liveChats.id,
      conversationId: liveChats.conversationId,
      siteKey: liveChats.siteKey,
      status: liveChats.status,
      createdAt: liveChats.createdAt,
      updatedAt: liveChats.updatedAt,
    })
    .from(liveChats)
    .innerJoin(conversations, eq(liveChats.conversationId, conversations.id))
    .orderBy(desc(liveChats.createdAt));

  // Get last message for each chat
  const chatsWithMessages = await Promise.all(
    chats.map(async (chat) => {
      const lastMessage = await db
        .select({
          content: messages.content,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.conversationId, chat.conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      return {
        ...chat,
        lastMessage: lastMessage[0] || undefined,
      };
    })
  );

  return Response.json(chatsWithMessages);
}