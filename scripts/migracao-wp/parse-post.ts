import * as cheerio from 'cheerio';

export type WpPost = {
  legacy_url: string;
  slug: string;
  category: string;
  title: string;
  meta_description: string;
  published_at: string | null;
  modified_at: string | null;
  og_image: string | null;
  tags: string[];
  content_html: string;
  images: string[];
  internal_links: string[];
  word_count: number;
  extracted_at: string;
};

// Sufixo do site no <title> — varia entre travessão/hífen e com/sem acentuação.
const TITLE_SUFFIX = /\s*[-–—]\s*Gest[ãa]o\s+Mais\s+Simples\s*$/i;

const INTERNAL_HOST = 'gestaomaissimples.com.br';

function isTinyIcon(width: string | undefined, height: string | undefined): boolean {
  const w = parseInt(width ?? '', 10);
  const h = parseInt(height ?? '', 10);
  if (!Number.isNaN(w) && w <= 50) return true;
  if (!Number.isNaN(h) && h <= 50) return true;
  return false;
}

export function parsePost(
  html: string,
  url: string,
  slug: string,
  category: string,
): WpPost {
  const $ = cheerio.load(html);

  // title — remove sufixo do site se houver
  const rawTitle = $('title').first().text().trim();
  const title = rawTitle.replace(TITLE_SUFFIX, '').trim();

  // metas
  const meta_description = $('meta[name="description"]').attr('content')?.trim() ?? '';
  const published_time = $('meta[property="article:published_time"]').attr('content');
  const modified_time = $('meta[property="article:modified_time"]').attr('content');
  const og_image = $('meta[property="og:image"]').attr('content');

  // tags
  const tags: string[] = [];
  $('meta[property="article:tag"]').each((_, el) => {
    const t = $(el).attr('content')?.trim();
    if (t) tags.push(t);
  });

  // content — theme-post-content tem 1 filho .elementor-widget-container com o artigo
  const themeEl = $('.elementor-widget-theme-post-content').first();
  const container = themeEl.find('.elementor-widget-container').first();
  const contentEl = container.length ? container : themeEl;
  const content_html = (contentEl.html() ?? '').trim();

  // images — filtra data: URI, SVG e ícones tiny
  const images: string[] = [];
  const seenImg = new Set<string>();
  contentEl.find('img').each((_, el) => {
    const node = $(el);
    const src = node.attr('src');
    if (!src) return;
    if (src.startsWith('data:')) return;
    if (/\.svg(\?|#|$)/i.test(src)) return;
    if (isTinyIcon(node.attr('width'), node.attr('height'))) return;
    if (seenImg.has(src)) return;
    seenImg.add(src);
    images.push(src);
  });

  // internal links — mesmos host ou path relativo
  const internal_links: string[] = [];
  const seenLink = new Set<string>();
  contentEl.find('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href || href.startsWith('#')) return;
    const isInternal = href.startsWith('/') || href.includes(INTERNAL_HOST);
    if (!isInternal) return;
    if (seenLink.has(href)) return;
    seenLink.add(href);
    internal_links.push(href);
  });

  // word count — strip HTML via text() do próprio cheerio
  const text = contentEl.text().replace(/\s+/g, ' ').trim();
  const word_count = text ? text.split(' ').length : 0;

  return {
    legacy_url: url,
    slug,
    category,
    title,
    meta_description,
    published_at: published_time ?? null,
    modified_at: modified_time ?? null,
    og_image: og_image ?? null,
    tags,
    content_html,
    images,
    internal_links,
    word_count,
    extracted_at: new Date().toISOString(),
  };
}
