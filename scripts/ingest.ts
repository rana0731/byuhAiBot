import 'dotenv/config';
import { load } from 'cheerio';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';

const { documents, chunks } = schema;

const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });

const DEFAULT_BASE_URL = 'https://admissions.byuh.edu';
const CHUNK_SIZE = 1000; // characters per chunk
const CHUNK_OVERLAP = 200;
const CONCURRENCY = 3;
const baseUrlInput = process.argv[2] || process.env.SCRAPE_BASE_URL || DEFAULT_BASE_URL;
const BASE_URL = new URL(baseUrlInput).href.replace(/\/$/, '');
const BASE_HOSTNAME = new URL(BASE_URL).hostname;

// ── Text chunking ─────────────────────────────────────────────────────────────

function chunkText(text: string): string[] {
  const result: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + CHUNK_SIZE;
    result.push(text.slice(start, end).trim());
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return result.filter((c) => c.length > 50);
}

// ── HTML → plain text ─────────────────────────────────────────────────────────

function extractText(html: string): { title: string; text: string } {
  const $ = load(html);

  // Remove noise
  $('script, style, noscript, nav, header, footer, .nav, .menu, .sidebar, .breadcrumb, [aria-hidden="true"]').remove();

  const title = $('title').first().text().trim() || $('h1').first().text().trim();

  // Prefer main content area, fall back to body
  const root = $('main, [role="main"], article, .content, #content, #main, body').first();

  const blocks: string[] = [];
  root.find('h1, h2, h3, h4, h5, h6, p, li, td, th, dt, dd').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.length > 0) blocks.push(t);
  });

  return { title, text: blocks.join('\n') };
}

// ── Link extraction ───────────────────────────────────────────────────────────

function extractLinks(html: string, pageUrl: string): string[] {
  const $ = load(html);
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')!;
    try {
      const url = new URL(href, pageUrl);
      // Stay on the same domain, strip hash and query
      if (url.hostname === BASE_HOSTNAME) {
        url.hash = '';
        url.search = '';
        links.push(url.href.replace(/\/$/, ''));
      }
    } catch {
      // malformed href — skip
    }
  });

  return [...new Set(links)];
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function upsertDocument(url: string, title: string): Promise<string> {
  const now = new Date();

  const existing = await db.query.documents.findFirst({ where: eq(documents.url, url) });

  if (existing) {
    await db.update(documents).set({ title, scrapedAt: now }).where(eq(documents.id, existing.id));
    return existing.id;
  }

  const [doc] = await db
    .insert(documents)
    .values({ url, title, scrapedAt: now })
    .returning({ id: documents.id });

  return doc.id;
}

async function saveChunks(documentId: string, textChunks: string[]) {
  // Delete old chunks for this doc before re-inserting
  await db.delete(chunks).where(eq(chunks.documentId, documentId));

  if (textChunks.length === 0) return;

  await db.insert(chunks).values(
    textChunks.map((content, chunkIndex) => ({ documentId, content, chunkIndex })),
  );
}

// ── Crawler ───────────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'BYUH-Admissions-Bot/1.0 (RAG indexer)' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok || !res.headers.get('content-type')?.includes('text/html')) return null;
    return res.text();
  } catch {
    return null;
  }
}

async function crawl() {
  const visited = new Set<string>();
  const queue: string[] = [BASE_URL];
  let pagesProcessed = 0;

  async function processUrl(url: string) {
    if (visited.has(url)) return;
    visited.add(url);

    const html = await fetchPage(url);
    if (!html) {
      console.log(`  SKIP  ${url}`);
      return;
    }

    const { title, text } = extractText(html);
    const textChunks = chunkText(text);

    const docId = await upsertDocument(url, title);
    await saveChunks(docId, textChunks);

    pagesProcessed++;
    console.log(`  [${pagesProcessed}] ${title || url}  (${textChunks.length} chunks)`);

    // Enqueue discovered links
    for (const link of extractLinks(html, url)) {
      if (!visited.has(link)) queue.push(link);
    }
  }

  console.log(`Starting crawl from ${BASE_URL}\n`);

  while (queue.length > 0) {
    const batch = queue.splice(0, CONCURRENCY);
    await Promise.all(batch.map(processUrl));
  }

  console.log(`\nDone. ${pagesProcessed} pages scraped.`);
}

crawl().catch((err) => {
  console.error(err);
  process.exit(1);
});
