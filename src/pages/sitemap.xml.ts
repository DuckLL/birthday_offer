// 給搜尋引擎的網站地圖：列表頁 + 每家店的詳細頁
import type { APIRoute } from 'astro';
import { getRestaurants, getShops } from '../lib/data';
import { detailUrl } from '../lib/shared';

export const GET: APIRoute = async ({ site }) => {
  const { items } = await getRestaurants();
  const shops = await getShops();
  const pages: [string, string?][] = [
    ['/'],
    ['/shops/'],
    ...items.map((r): [string, string] => [detailUrl('r', r.id), r.data.updated]),
    ...shops.map((s): [string, string] => [detailUrl('s', s.id), s.data.updated]),
  ];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages.map(([p, d]) => `  <url><loc>${esc(new URL(p, site).href)}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>`).join('\n') +
    '\n</urlset>\n';
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
