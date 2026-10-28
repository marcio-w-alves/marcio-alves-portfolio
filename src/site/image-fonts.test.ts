import { describe, expect, it } from 'vitest';
import { fixtureBrand } from '@/testing/fixture-profile/brand';
import { loadImageFonts } from './image-fonts';

const WOFF_SIGNATURE = 'wOFF';

describe('loadImageFonts', () => {
  it('reads both weights of the brand’s image face as WOFF', async () => {
    const fonts = await loadImageFonts(fixtureBrand.imageFont);

    expect(fonts.map(({ name, weight, style }) => ({ name, weight, style }))).toEqual([
      { name: 'Inter Tight', weight: 400, style: 'normal' },
      { name: 'Inter Tight', weight: 600, style: 'normal' },
    ]);
    for (const { data } of fonts) expect(data.subarray(0, 4).toString()).toBe(WOFF_SIGNATURE);
  });

  it('fails when a weight names a file that is not there', async () => {
    const missing = {
      ...fixtureBrand.imageFont,
      files: { ...fixtureBrand.imageFont.files, 600: 'nope.woff' },
    };

    await expect(loadImageFonts(missing)).rejects.toThrow(/nope\.woff/);
  });
});
