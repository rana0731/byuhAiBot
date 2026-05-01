import { createGateway } from '@ai-sdk/gateway';
import { convertToModelMessages, embed, jsonSchema, stepCountIs, streamText, tool } from 'ai';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chunks, conversations, documents, liveChats, messages } from '@/db/schema';
import { getDepartmentLabel, getSourceLabel, LIVE_CHAT_PRIORITY_SITES } from '@/lib/source-sites';

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const LIVE_ADMIN_REGEX = /\b(live admin|contact.*admin|talk to (a )?live admin|connect.*admin|help from|admin support|live chat|contact live)\b/i;
const APPLY_TO_BYUH_REGEX = /\b(i want to apply|how (do|can) i apply|apply (to|for|at)|start (an|my) application|submit (an|my) application|admissions application)\b/i;
const OFFICIAL_APPLICATION_URL = 'https://apply.byuh.edu/';
const LOCAL_APPLICATION_PATH = '/apply';

type ApplyAdmissionInput = {
  name?: string;
  email?: string;
};


function findLiveAdminSite(userText: string) {
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

function extractApplyAdmissionPrefill(userText: string): ApplyAdmissionInput {
  const email = userText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const name =
    userText.match(/\b(?:my name is|i am|i'm)\s+([a-z][a-z\s'-]{1,60})(?:\s+and|\s*,|\.|$)/i)?.[1]
      ?.trim();

  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
  };
}

function createApplyAdmissionUrl(input: ApplyAdmissionInput = {}) {
  const params = new URLSearchParams();

  if (input.name?.trim()) {
    params.set('name', input.name.trim());
  }

  if (input.email?.trim()) {
    params.set('email', input.email.trim());
  }

  const query = params.toString();

  return query ? `${LOCAL_APPLICATION_PATH}?${query}` : LOCAL_APPLICATION_PATH;
}

function createApplyAdmissionResponse(input: ApplyAdmissionInput = {}) {
  const applyUrl = createApplyAdmissionUrl(input);

  return `I can start your BYU-Hawaii admission application here:

${applyUrl}

That page will show a prefilled form${input.name || input.email ? ' with the details I found' : ''}. After you review and submit it, the app will continue to the official BYU-Hawaii application system.

## Sources
- BYU-Hawaii application: ${OFFICIAL_APPLICATION_URL}`;
}

const applyAdmissionTool = tool({
  description: 'Start the BYU-Hawaii admission application process with optional prefilled applicant details.',
  inputSchema: jsonSchema<ApplyAdmissionInput>({
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Applicant full name, if the user provided it.',
      },
      email: {
        type: 'string',
        description: 'Applicant email address, if the user provided it.',
      },
    },
    additionalProperties: false,
  }),
  execute: async ({ name, email }) => {
    const redirectUrl = createApplyAdmissionUrl({ name, email });

    return {
      redirectUrl,
      message: createApplyAdmissionResponse({ name, email }),
    };
  },
});

function createTextStreamResponse(responseText: string, convId: string) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          const messageEvent = {
            type: 'text-delta',
            textDelta: responseText,
          };
          controller.enqueue(encoder.encode(`0:${JSON.stringify([messageEvent])}\n`));

          const finalEvent = {
            type: 'message-delta',
            delta: { role: 'assistant', content: '' },
          };
          controller.enqueue(encoder.encode(`d:${JSON.stringify(finalEvent)}\n`));

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Conversation-Id': convId,
      },
    },
  );
}

async function saveStaticExchange(userText: string, responseText: string, conversationId?: string) {
  let convId: string = conversationId ?? '';

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

  await db.insert(messages).values({
    conversationId: convId,
    role: 'assistant',
    content: responseText,
  });

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, convId));

  return convId;
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

  if (APPLY_TO_BYUH_REGEX.test(userText) && !LIVE_ADMIN_REGEX.test(userText)) {
    const responseText = createApplyAdmissionResponse(extractApplyAdmissionPrefill(userText));
    const convId = await saveStaticExchange(userText, responseText, conversationId);

    return createTextStreamResponse(responseText, convId);
  }

  if (LIVE_ADMIN_REGEX.test(userText)) {
    const liveAdminSite = findLiveAdminSite(userText);
    let responseText: string;

    if (liveAdminSite) {
      responseText = `You are connected to the ${getDepartmentLabel(liveAdminSite.key)} department live admin. An admin will be with you shortly.`;
      const convId = await saveStaticExchange(userText, responseText, conversationId);

      // Create live chat session
      await db.insert(liveChats).values({
        conversationId: convId,
        siteKey: liveAdminSite.key,
        status: 'pending',
      });

      return createTextStreamResponse(responseText, convId);
    }

    responseText = `Please choose one of the following options to connect with a live admin: Admissions, Financial Aid, or OIT. Let me know which one you'd like!\n\n[SHOW_DEPARTMENTS]`;
    const convId = await saveStaticExchange(userText, responseText, conversationId);

    return createTextStreamResponse(responseText, convId);
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

  // Check if there's an active live chat for this conversation
  const activeLiveChat = await db.query.liveChats.findFirst({
    where: (liveChats, { eq, and, or }) =>
      and(
        eq(liveChats.conversationId, convId),
        or(
          eq(liveChats.status, 'pending'),
          eq(liveChats.status, 'active'),
        ),
      ),
  });

  // If there's an active live chat, don't use AI - just save the message
  if (activeLiveChat) {
    await db.insert(messages).values({
      conversationId: convId,
      role: 'user',
      content: userText,
    });

    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, convId));

    // Return empty response - the admin will respond via the admin API
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            const ackEvent = {
              type: 'text-delta',
              textDelta: '',
            };
            controller.enqueue(encoder.encode(`0:${JSON.stringify([ackEvent])}\n`));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Conversation-Id': convId,
        },
      },
    );
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
    tools: {
      applyAdmission: applyAdmissionTool,
    },
    stopWhen: stepCountIs(2),
    system: `You are a helpful BYU-Hawaii assistant.
Answer questions using only the context below.
If the answer is not covered, say so honestly and suggest the student contact the relevant BYU-Hawaii office.
Only include a markdown section titled "Sources" when you used source context for a factual answer or when you recommend a specific URL/resource.
When you include "Sources", list only the most relevant source URLs from the allowed sources below, preserving the website label.
Do not invent or change source URLs, and do not cite sources outside the allowed list.
For casual replies, clarifying questions, live admin routing, or answers that do not need a source, omit the "Sources" section.

If the user asks to contact a live admin, provide the user with the live chat options Admissions, Financial Aid, or OIT.
When a specific site is named, answer using this exact pattern: "We are connecting you to <Site Label>'s live admin." If no site is named, ask the user to choose one of those three.
If the user asks to apply to BYU-Hawaii, start an application, or submit an admissions application, use the applyAdmission tool. Use the tool result message in your response. Do not treat applying for admission as a request to contact a live admin unless they explicitly ask for a live admin or a person.

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
