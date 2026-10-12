import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseFirebaseConfig } from '../src/firebase';
import { SITE, SITE_LINKS } from '../src/site';
import { renderRobots, renderSitePage, renderSitemap } from './site-pages';

export function sitePages(): Plugin {
  let base = '/';
  let cloudEnabled = false;
  return {
    name: 'public-site-pages',
    configResolved(config) {
      base = config.base;
      cloudEnabled = !!parseFirebaseConfig(JSON.parse(readFileSync(resolve(config.root, 'public/firebase-config.json'), 'utf8')), config.command === 'serve' ? 'localhost' : new URL(SITE.url).hostname);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://localhost').pathname;
        const page = SITE_LINKS.find(item => [`/${item.id}`, `/${item.id}/`, `/${item.id}/index.html`].includes(path));
        if (!page && path !== '/sitemap.xml' && path !== '/robots.txt') return next();
        if (page && path === `/${page.id}`) { res.statusCode = 302; res.setHeader('Location', `/${page.id}/`); res.end(); return; }
        res.setHeader('Content-Type', page ? 'text/html; charset=utf-8' : path.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8');
        res.end(page ? renderSitePage(page.id, base, cloudEnabled) : path === '/sitemap.xml' ? renderSitemap() : renderRobots());
      });
    },
    transformIndexHtml() {
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: SITE.url }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:title', content: SITE.name }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:description', content: '국내·해외 아티스트와 좋아하는 세 곡으로 만드는 나의 티어표.' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: SITE.url }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:type', content: 'website' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:locale', content: 'ko_KR' }, injectTo: 'head' },
        { tag: 'noscript', children: `<p>아티스트 티어표를 만들려면 JavaScript를 켜 주세요. <a href="${base}about/">사이트 소개</a> · <a href="${base}guide/">이용 안내</a> · <a href="${base}privacy/">개인정보처리방침</a></p>`, injectTo: 'body-prepend' },
      ];
    },
    generateBundle() {
      for (const page of SITE_LINKS) this.emitFile({ type: 'asset', fileName: `${page.id}/index.html`, source: renderSitePage(page.id, base, cloudEnabled) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: renderSitemap() });
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: renderRobots() });
    },
  };
}
