import { createGateway } from '@ai-sdk/gateway';
import { convertToModelMessages, embed, streamText } from 'ai';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chunks, conversations, documents, messages } from '@/db/schema';

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const EMBEDDING_MODEL = 'openai/text-embedding-3-small';
const CHAT_MODEL = 'openai/gpt-4o-mini';
const TOP_K = 5;

export async function POST(req: Request) {
  const { messages: clientMessages, conversationId } = await req.json();

  const userMessage = clientMessages[clientMessages.length - 1] as {
    content?: string | null;
    parts?: Array<{ type: string; text?: string }>;
    role: string;
  };

  const userText =
    userMessage.parts
      ?.filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('') || userMessage.content || '';

  if (!userText.trim()) {
    return new Response('Message cannot be empty.', { status: 400 });
  }

  const { embedding: queryEmbedding } = await embed({
    model: gateway.textEmbeddingModel(EMBEDDING_MODEL),
    value: userText,
  });

  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  const relevantChunks = await db
    .select({
      content: chunks.content,
      title: documents.title,
      url: documents.url,
      similarity: sql<number>`1 - (${chunks.embedding} <=> ${vectorLiteral}::vector)`,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .orderBy(sql`${chunks.embedding} <=> ${vectorLiteral}::vector`)
    .limit(TOP_K);

  const context = relevantChunks
    .map((chunk) => `[${chunk.title ?? chunk.url}]\n${chunk.content}`)
    .join('\n\n---\n\n');

  let convId: string = conversationId;

  if (!convId) {
    const [conversation] = await db
      .insert(conversations)
      .values({})
      .returning({ id: conversations.id });
    convId = conversation.id;
  }

  await db.insert(messages).values({
    conversationId: convId,
    role: 'user',
    content: userText,
  });

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, convId));

  const result = streamText({
    model: gateway(CHAT_MODEL),
    system: `You are a helpful admissions assistant for BYU-Hawaii.
Answer questions using only the context below.
If the answer is not covered, say so honestly and suggest the student contact the admissions office.

<context>
${context}
</context>`,
    messages: await convertToModelMessages(clientMessages),
    async onFinish({ text }) {
      await db.insert(messages).values({
        conversationId: convId,
        role: 'assistant',
        content: text,
      });

      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, convId));
    },
  });

  return result.toUIMessageStreamResponse({
    headers: {
      'X-Conversation-Id': convId,
    },
  });
}


// pilot
// sso
