import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { fixtureBrand, fixtureSiteProfile } from '@/testing/fixture-profile';
import { createSite } from './create-site';

const site = createSite(fixtureSiteProfile, {
  fontClassName: '',
  siteUrl: () => new URL('https://ada.example'),
});

async function pixelAt(image: Response, x: number, y: number): Promise<string> {
  const png = PNG.sync.read(Buffer.from(await image.arrayBuffer()));
  const offset = (png.width * y + x) * 4;
  const channels = [...png.data.subarray(offset, offset + 3)];
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

describe("the generated images, in the profile's own brand", () => {
  it('paints the share image on the brand background', async () => {
    const fonts = await site.imageFonts();
    const image = site.shareImage({ width: 1200, height: 630 }, fonts);
    expect(await pixelAt(image, 2, 2)).toBe(fixtureBrand.colors.bg);
  });

  it('paints the home-screen icon in the brand ink', async () => {
    const fonts = await site.imageFonts();
    const image = site.appleIcon({ width: 180, height: 180 }, fonts);
    expect(await pixelAt(image, 2, 2)).toBe(fixtureBrand.colors.ink);
  });
});
