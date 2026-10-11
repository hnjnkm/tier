import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITE, SITE_LINKS } from '../src/site';
import { renderSitePage, renderSitemap, renderRobots } from '../scripts/site-pages';

test('public information pages contain readable content without JavaScript and use the Pages subpath for navigation and assets', () => {
  for (const item of SITE_LINKS) {
    const html = renderSitePage(item.id, '/tier/');
    assert.ok(html.includes(`<h1>${item.label}</h1>`));
    assert.ok(html.includes(`href="${SITE.url}${item.id}/"`));
    assert.ok(html.includes('href="/tier/site.css"'));
    assert.ok(html.includes('href="/tier/?chart=global"'));
    for (const link of SITE_LINKS) assert.ok(html.includes(`href="/tier/${link.id}/"`));
    assert.ok(!/<script\b|<form\b|adsbygoogle|googlesyndication/.test(html));
    assert.ok(html.includes('<main id="content"'));
  }
});

test('privacy describes actual local saves and external providers without inventing an enabled advertising service', () => {
  const html = renderSitePage('privacy', '/tier/');
  for (const text of ['localStorage', '운영자에게 전송하지 않습니다', 'MusicBrainz', 'GitHub Pages', 'Google AdSense 광고 코드와 광고용 쿠키는 사용하지 않습니다', SITE.operator]) assert.ok(html.includes(text));
  assert.ok(html.includes(SITE.issuesUrl));
});

test('a future root domain updates canonicals and sitemap without keeping project-subpath links', () => {
  const previous = SITE.url;
  try {
    SITE.url = 'https://example.org/';
    const html = renderSitePage('privacy', '/');
    assert.ok(html.includes('href="https://example.org/privacy/"'));
    assert.ok(html.includes('href="/site.css"'));
    assert.ok(!/(?:href|src)="\/tier\//.test(html));
    assert.ok(renderSitemap().includes('<loc>https://example.org/?chart=global</loc>'));
    assert.ok(renderRobots().includes('Sitemap: https://example.org/sitemap.xml'));
  } finally { SITE.url = previous; }
});

test('operator and contact configuration are escaped and a real email replaces the public issue contact', () => {
  const operator = SITE.operator, email = SITE.contactEmail;
  try {
    SITE.operator = '<img src=x onerror=alert(1)>';
    SITE.contactEmail = 'hello@example.org';
    const html = renderSitePage('contact', '/tier/');
    assert.ok(html.includes('href="mailto:hello@example.org"'));
    assert.ok(!html.includes(`href="${SITE.issuesUrl}"`));
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!html.includes('<img src=x'));
  } finally { SITE.operator = operator; SITE.contactEmail = email; }
});
