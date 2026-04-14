import 'dotenv/config';
import { embedMany, createGateway } from 'ai';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { isNull, eq } from 'drizzle-orm';
import * as schema from '../db/schema';

const { chunks } = schema;

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const EMBEDDING_MODEL = 'openai/text-embedding-3-small'; // 1536 dimensions — matches schema
const BATCH_SIZE = 100; // embedMany handles up to 2048 values per call

async function run() {
  const pending = await db.query.chunks.findMany({
    where: isNull(chunks.embedding),
    columns: { id: true, content: true },
  });

  if (pending.length === 0) {
    console.log('All chunks are already embedded.');
    return;
  }

  console.log(`Embedding ${pending.length} chunks in batches of ${BATCH_SIZE}...\n`);

  let processed = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);

    const { embeddings } = await embedMany({
      model: gateway.textEmbeddingModel(EMBEDDING_MODEL),
      values: batch.map((c) => c.content),
    });

    await Promise.all(
      batch.map((chunk, idx) =>
        db
          .update(chunks)
          .set({ embedding: embeddings[idx] as number[] })
          .where(eq(chunks.id, chunk.id)),
      ),
    );

    processed += batch.length;
    console.log(`  ${processed}/${pending.length}`);
  }

  console.log(`\nDone. ${processed} chunks embedded.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
