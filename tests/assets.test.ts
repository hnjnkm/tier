import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAssetUrl } from '../server/assets';

test('the media relay accepts only exact supported HTTPS image or audio hosts', () => {
  assert.equal(validateAssetUrl('https://thumb.wikimedia.org/example.jpg', 'image').hostname, 'thumb.wikimedia.org');
  assert.equal(validateAssetUrl('https://audio-ssl.itunes.apple.com/preview.m4a', 'audio').hostname, 'audio-ssl.itunes.apple.com');
  for (const url of ['http://upload.wikimedia.org/a', 'https://upload.wikimedia.org.evil.test/a', 'https://127.0.0.1/a', 'https://user:pass@upload.wikimedia.org/a', 'https://upload.wikimedia.org:8080/a', 'file:///etc/passwd']) assert.throws(() => validateAssetUrl(url, 'image'));
  assert.throws(() => validateAssetUrl('https://audio-ssl.itunes.apple.com/preview.m4a', 'image'));
  assert.throws(() => validateAssetUrl('https://thumb.wikimedia.org/a.jpg', 'audio'));
});
