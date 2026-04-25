import { db } from '@/db';
import { conversations, liveChats, messages } from '@/db/schema';
import { getSourceLabel, LIVE_CHAT_PRIORITY_SITES } from '@/lib/source-sites';

export async function POST(req: Request) {
  const { conversationId, siteKey } = await req.json();

  if (!siteKey) {
    return Response.json(
      { error: 'Site key is required' },
      { status: 400 }
    );
  }

  // Validate site key
  const isValidSite = LIVE_CHAT_PRIORITY_SITES.some(site => site.key === siteKey);
  if (!isValidSite) {
    return Response.json(
      { error: 'Invalid site key' },
      { status: 400 }
    );
  }

  let convId = conversationId;

  // Create conversation if not provided
  if (!convId) {
    const [conversation] = await db
      .insert(conversations)
      .values({})
      .returning({ id: conversations.id });
    convId = conversation.id;
  }

  // Create live chat request
  const [liveChat] = await db
    .insert(liveChats)
    .values({
      conversationId: convId,
      siteKey,
      status: 'pending',
    })
    .returning({ id: liveChats.id });

  // Add system message
  await db.insert(messages).values({
    conversationId: convId,
    role: 'assistant',
    content: `You've been connected to our ${getSourceLabel(siteKey)} department. An agent will be with you shortly.`,
  });

  return Response.json({
    success: true,
    conversationId: convId,
    liveChatId: liveChat.id,
  });
}
