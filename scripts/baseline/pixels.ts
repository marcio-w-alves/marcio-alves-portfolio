import { PNG } from 'pngjs';

/**
 * Two PNGs compared exactly, pixel by pixel: no tolerance and no
 * anti-aliasing allowance, because two captures of one build render the same
 * pixels and the baseline expects zero.
 */
export type PixelComparison =
  | { readonly kind: 'same-size'; readonly differingPixels: number }
  | { readonly kind: 'different-size'; readonly baseline: string; readonly target: string };

const CHANNELS = 4;

export function comparePixels(baselinePng: Uint8Array, targetPng: Uint8Array): PixelComparison {
  const baseline = PNG.sync.read(Buffer.from(baselinePng));
  const target = PNG.sync.read(Buffer.from(targetPng));
  if (baseline.width !== target.width || baseline.height !== target.height) {
    return { kind: 'different-size', baseline: sizeOf(baseline), target: sizeOf(target) };
  }
  let differingPixels = 0;
  for (let offset = 0; offset < baseline.data.length; offset += CHANNELS) {
    if (
      baseline.data.compare(target.data, offset, offset + CHANNELS, offset, offset + CHANNELS) !== 0
    ) {
      differingPixels += 1;
    }
  }
  return { kind: 'same-size', differingPixels };
}

function sizeOf({ width, height }: PNG): string {
  return `${String(width)}×${String(height)}`;
}

export function describePixels(comparison: PixelComparison): string {
  return comparison.kind === 'same-size'
    ? `${String(comparison.differingPixels)} px differ`
    : `size ${comparison.baseline} → ${comparison.target}`;
}

export function pixelsDiffer(comparison: PixelComparison): boolean {
  return comparison.kind === 'different-size' || comparison.differingPixels > 0;
}
