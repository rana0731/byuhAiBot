import { createGateway } from '@ai-sdk/gateway';
import { convertToModelMessages, embed, streamText } from 'ai';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chunks, conversations, documents, liveChats, messages } from '@/db/schema';
import { getSourceLabel, LIVE_CHAT_PRIORITY_SITES } from '@/lib/source-sites';

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const LIVE_AGENT_REGEX = /\b(live agent|contact.*agent|talk to (a )?live agent|connect.*agent|help from|support agent|agent support)\b/i;

function findLiveAgentSite(userText: string) {
  const normalized = userText.toLowerCase();

  for (const site of LIVE_CHAT_PRIORITY_SITES) {
    if (normalized.includes('admissions') && site.key === 'admissions') {
      return site;
    }
    if ((normalized.includes('financial aid') || normalized.includes('financialaid')) && site.key === 'financialaid') {
      return site;
    }
    if (normalized.includes('oit') && site.key === 'oit') {
      return site;
    }
  }

  return null;
}

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

  const liveAgentSite = LIVE_AGENT_REGEX.test(userText)
    ? findLiveAgentSite(userText)
    : null;

  if (LIVE_AGENT_REGEX.test(userText)) {
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

    let responseText: string;
    if (liveAgentSite) {
      // Create live chat session
      await db.insert(liveChats).values({
        conversationId: convId,
        siteKey: liveAgentSite.key,
        status: 'pending',
      });
      responseText = `Connecting you to our ${liveAgentSite.label}. An agent will be with you shortly!`;
    } else {
      responseText = `I can help connect you with a live agent! Click the "Connect to Agent" button at the top of the page, then select which department you'd like to reach: Admissions, Financial Aid, or OIT.`;
    }

    await db.insert(messages).values({
      conversationId: convId,
      role: 'assistant',
      content: responseText,
    });

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, convId));

    return streamText({
      model: gateway(CHAT_MODEL),
      messages: [
        {
          role: 'user',
          content: responseText,
        },
      ],
      async onFinish() {
        // already persisted
      },
    }).toUIMessageStreamResponse({
      headers: {
        'X-Conversation-Id': convId,
      },
    });
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
  const availableSources = [...new Map(
    relevantChunks.map((chunk) => [
      chunk.url,
      `- ${getSourceLabel(chunk.url)}: ${chunk.url}`,
    ]),
  ).values()].join('\n');

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
    system: `You are a helpful BYU-Hawaii assistant.
Answer questions using only the context below.
If the answer is not covered, say so honestly and suggest the student contact the relevant BYU-Hawaii office.
Always end your answer with a markdown section titled "Sources".
In that section, list the most relevant source URLs you used from the allowed sources below, preserving the website label.
Do not invent or change source URLs, and do not cite sources outside the allowed list.

If the user asks to contact a live agent, provide the user with the live chat options Admissions, Financial Aid, or OIT.
When a specific site is named, answer using this exact pattern: "We contacting you to <Site Label>'s live agent." If no site is named, ask the user to choose one of those three.

<allowed-sources>
${availableSources}
</allowed-sources>

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
