import sharp from 'sharp';
import type { Portrait } from '../src/types';

// Profiles already compose the subject. Preserve the entire photo instead of
// asking an attention crop to choose a face from a banner or a group portrait.
export async function squarePortrait(bytes: Buffer, crop?: Portrait['crop']) {
  const photo = sharp(bytes).rotate();
  if (crop) photo.extract(crop);
  return photo.resize(256, 256, { fit: 'contain', background: '#ededeb' }).webp({ quality: 85 }).toBuffer();
}
