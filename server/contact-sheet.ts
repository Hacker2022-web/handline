import sharp from 'sharp';
import type { VerificationRequest } from '../src/lib/types';

// A single labeled image avoids runners inconsistently attending to multiple images.
// It is assembled in memory; neither incoming crops nor the sheet are written to disk.
export async function makeContactSheet(request: VerificationRequest): Promise<string> {
  const tiles = [{ label: 'LIVE POSE', image: request.image }, ...request.candidates.flatMap((candidate, index) => candidate.references.map((image, sample) => ({ label: `REFERENCE ${String.fromCharCode(65 + index)}${sample + 1}`, image })))];
  const columns = Math.min(3, tiles.length), width = 320, header = 38, height = 358;
  const composites = await Promise.all(tiles.flatMap((tile, index) => {
    const left = index % columns * width, top = Math.floor(index / columns) * height;
    const label = Buffer.from(`<svg width="${width}" height="${header}"><rect width="100%" height="100%" fill="${index === 0 ? '#254f41' : '#e8ede3'}"/><text x="16" y="26" font-family="sans-serif" font-size="20" font-weight="bold" fill="${index === 0 ? '#ffffff' : '#254f41'}">${tile.label}</text></svg>`);
    return [
      Promise.resolve({ input: label, left, top }),
      sharp(Buffer.from(tile.image.split(',')[1], 'base64'), { limitInputPixels: 4_000_000 }).rotate().resize(width, height - header, { fit: 'contain', background: '#e8ede3' }).jpeg({ quality: 85 }).toBuffer().then(input => ({ input, left, top: top + header })),
    ];
  }));
  const image = await sharp({ create: { width: columns * width, height: Math.ceil(tiles.length / columns) * height, channels: 3, background: '#e8ede3' } }).composite(composites).jpeg({ quality: 88 }).toBuffer();
  return image.toString('base64');
}
