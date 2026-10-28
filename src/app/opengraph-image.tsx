import { site } from '@/site-root';

export const alt = site.shareImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Read when the module loads, not inside the handler: a file read there would
// make the image render on every request instead of once, at build.
const fonts = await site.imageFonts();

export default function OpenGraphImage() {
  return site.shareImage(size, fonts);
}
