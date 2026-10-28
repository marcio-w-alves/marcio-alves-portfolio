import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { fixtureBrand } from '@/testing/fixture-profile';
import { fixtureSite } from '@/testing/fixture-site';

const site = fixtureSite({ locales: ['en', 'pt-BR'] });

async function pixelAt(image: Response, x: number, y: number): Promise<string> {
  const png = PNG.sync.read(Buffer.from(await image.arrayBuffer()));
  const offset = (png.width * y + x) * 4;
  const channels = [...png.data.subarray(offset, offset + 3)];
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

describe("the generated images, in the profile's own brand", () => {
  it('paints the share image on the brand background', async () => {
    const fonts = await site.imageFonts();
    const image = site.shareImage('en', fonts);
    expect(await pixelAt(image, 2, 2)).toBe(fixtureBrand.colors.bg);
  });

  it('draws one 1200×630 share image per language the build serves', async () => {
    const fonts = await site.imageFonts();
    const sizes = await Promise.all(
      ['en', 'pt'].map(async (segment) => {
        const png = PNG.sync.read(Buffer.from(await site.shareImage(segment, fonts).arrayBuffer()));
        return [png.width, png.height];
      }),
    );
    expect(sizes).toEqual([
      [1200, 630],
      [1200, 630],
    ]);
  });

  it('paints the home-screen icon in the brand ink', async () => {
    const fonts = await site.imageFonts();
    const image = site.appleIcon({ width: 180, height: 180 }, fonts);
    expect(await pixelAt(image, 2, 2)).toBe(fixtureBrand.colors.ink);
  });
});
