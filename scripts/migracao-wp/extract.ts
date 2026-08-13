/**
 * S1.T1+T2 — Baixa e parseia os posts do WordPress antigo.
 *
 * - Sitemap: https://gestaomaissimples.com.br/post-sitemap.xml
 * - Filtra só /blog/{categoria}/{slug}/ (descarta /sistema/*, /wp-content/* etc.)
 * - fetch nativo, concorrência 5, retry 3x com backoff exponencial, timeout 30s
 * - Resumível: lê data/wp-posts.json existente e pula os legacy_url já processados
 * - Salva incrementalmente a cada SAVE_EVERY posts
 *
 * Uso: npx tsx scripts/migracao-wp/extract.ts
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as cheerio from 'cheerio';
import { parsePost, type WpPost } from './parse-post';

const SITEMAP_URL = 'https://gestaomaissimples.com.br/post-sitemap.xml';
const DATA_DIR = path.join(process.cwd(), 'data');
const OUT_JSON = path.join(DATA_DIR, 'wp-posts.json');

const CONCURRENCY = 5;
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1_000; // 1s, 2s, 4s
const SAVE_EVERY = 20;

// Casa SÓ /blog/{categoria}/{slug}/ — descarta tudo fora desse padrão.
const BLOG_RE = /^https:\/\/gestaomaissimples\.com\.br\/blog\/([^/]+)\/([^/]+?)\/?$/;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, isXml = false): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: isXml
            ? 'application/xml,text/xml,*/*;q=0.8'
            : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < MAX_RETRIES - 1) {
        const delay = BACKOFF_BASE_MS * 2 ** attempt;
        await sleep(delay);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr ?? 'fetch failed'));
}

async function fetchSitemapUrls(): Promise<string[]> {
  const xml = await fetchWithRetry(SITEMAP_URL, true);
  const $ = cheerio.load(xml, { xml: true });
  const urls: string[] = [];
  $('loc').each((_, el) => {
    const u = $(el).text().trim();
    if (u) urls.push(u);
  });
  return urls;
}

async function loadExisting(): Promise<WpPost[]> {
  try {
    const raw = await fs.readFile(OUT_JSON, 'utf8');
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as WpPost[];
  } catch {
    // arquivo não existe ou JSON inválido — começa do zero
  }
  return [];
}

async function saveJson(posts: WpPost[]): Promise<void> {
  await fs.writeFile(OUT_JSON, JSON.stringify(posts, null, 2), 'utf8');
}

type TodoItem = { url: string; category: string; slug: string };

async function pool<T>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  async function run(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      await worker(items[i] as T);
    }
  }
  const workers = Array.from(
    { length: Math.min(size, items.length) },
    () => run(),
  );
  await Promise.all(workers);
}

async function main(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const existing = await loadExisting();
  const done = new Set(existing.map(p => p.legacy_url));
  if (existing.length > 0) {
    console.log(`[resume] ${existing.length} posts já extraídos — vou pular.`);
  }

  console.log('[sitemap] baixando...');
  const allUrls = await fetchSitemapUrls();
  console.log(`[sitemap] ${allUrls.length} URLs no total.`);

  const filtered: TodoItem[] = [];
  let discarded = 0;
  for (const url of allUrls) {
    const m = url.match(BLOG_RE);
    if (m && m[1] && m[2]) {
      filtered.push({ url, category: m[1], slug: m[2] });
    } else {
      discarded++;
    }
  }
  console.log(
    `[filtro] ${filtered.length} posts de blog válidos, ${discarded} URLs descartadas.`,
  );

  const todo = filtered.filter(it => !done.has(it.url));
  console.log(
    `[todo] ${todo.length} pendentes (conc=${CONCURRENCY}, retries=${MAX_RETRIES}, timeout=${TIMEOUT_MS / 1000}s).`,
  );

  if (todo.length === 0) {
    console.log('[todo] nada a fazer.');
  } else {
    const failures: { url: string; error: string }[] = [];
    let processed = 0;
    let successTotal = existing.length;

    await pool(todo, CONCURRENCY, async (item) => {
      try {
        const html = await fetchWithRetry(item.url);
        const post = parsePost(html, item.url, item.slug, item.category);
        existing.push(post);
        successTotal++;
      } catch (err) {
        failures.push({
          url: item.url,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        processed++;
        if (processed % SAVE_EVERY === 0) {
          await saveJson(existing);
          console.log(
            `[${successTotal}/${filtered.length}] processados ${processed}/${todo.length} (falhas: ${failures.length})`,
          );
        }
      }
    });

    await saveJson(existing);
    console.log(
      `[fim] processados ${processed}/${todo.length} | OK=${successTotal} falhas=${failures.length}`,
    );
    if (failures.length > 0) {
      console.log('URLs que falharam:');
      for (const f of failures) console.log(`  - ${f.url}  (${f.error})`);
    }
  }

  // relatório final
  const total = existing.length;
  const totalWords = existing.reduce((s, p) => s + p.word_count, 0);
  const totalImgs = existing.reduce((s, p) => s + p.images.length, 0);
  const totalLinks = existing.reduce((s, p) => s + p.internal_links.length, 0);
  const avgWords = total > 0 ? Math.round(totalWords / total) : 0;
  const cats = Array.from(new Set(existing.map(p => p.category))).sort();
  const withPub = existing.filter(p => p.published_at).length;
  const withOg = existing.filter(p => p.og_image).length;

  console.log('\n========== RESUMO ==========');
  console.log(`Posts no JSON: ${total}/${filtered.length}`);
  console.log(`Média de palavras: ${avgWords}`);
  console.log(`Total de imagens (no conteúdo): ${totalImgs}`);
  console.log(`Total de links internos: ${totalLinks}`);
  console.log(`Posts com published_at: ${withPub}/${total}`);
  console.log(`Posts com og_image: ${withOg}/${total}`);
  console.log(`Categorias (${cats.length}): ${cats.join(', ')}`);
  console.log(`JSON salvo em: ${OUT_JSON}`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
