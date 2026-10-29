import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { comparePixels } from './pixels';

function png(width: number, height: number, paint: (x: number, y: number) => number = () => 0xee) {
  const image = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      image.data.fill(paint(x, y), offset, offset + 3);
      image.data[offset + 3] = 0xff;
    }
  }
  return PNG.sync.write(image);
}

describe('counting differing pixels', () => {
  it('finds none in identical screenshots', () => {
    expect(comparePixels(png(40, 30), png(40, 30))).toEqual({
      kind: 'same-size',
      differingPixels: 0,
    });
  });

  it('counts a single changed pixel as one', () => {
    const changed = png(40, 30, (x, y) => (x === 7 && y === 3 ? 0xed : 0xee));

    expect(comparePixels(png(40, 30), changed)).toEqual({ kind: 'same-size', differingPixels: 1 });
  });

  it('reports different dimensions as a difference instead of failing', () => {
    expect(comparePixels(png(40, 30), png(40, 31))).toEqual({
      kind: 'different-size',
      baseline: '40×30',
      target: '40×31',
    });
  });
});
