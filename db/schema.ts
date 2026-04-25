import { pgTable, uuid, text, timestamp, pgEnum, integer, index, vector } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- RAG: scraped pages ---

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull().unique(),
  title: text('title'),
  scrapedAt: timestamp('scraped_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// --- RAG: text chunks with embeddings ---
// embedding is nullable — populated after the chunk is sent to the embedding model
// 1536 dimensions = text-embedding-3-small (OpenAI)

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    embedding: vector('embedding', { dimensions: 1536 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('chunks_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  ],
);

export const documentsRelations = relations(documents, ({ many }) => ({
  chunks: many(chunks),
}));

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, {
    fields: [chunks.documentId],
    references: [documents.id],
  }),
}));


export const messageRoleEnum = pgEnum('message_role', [
  'user',
  'assistant',
  'system',
  'tool',
]);

export const liveChatStatusEnum = pgEnum('live_chat_status', [
  'pending',
  'active',
  'completed',
  'cancelled',
]);

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const liveChats = pgTable('live_chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  siteKey: text('site_key').notNull(),
  status: liveChatStatusEnum('status').notNull().default('pending'),
  adminId: uuid('admin_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
  liveChats: many(liveChats),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const liveChatsRelations = relations(liveChats, ({ one }) => ({
  conversation: one(conversations, {
    fields: [liveChats.conversationId],
    references: [conversations.id],
  }),
}));

