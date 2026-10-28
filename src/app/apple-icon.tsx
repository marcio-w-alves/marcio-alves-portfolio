import { site } from '@/site-root';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Read when the module loads, not inside the handler: a file read there would
// make the image render on every request instead of once, at build.
const fonts = await site.imageFonts();

export default function AppleIcon() {
  return site.appleIcon(size, fonts);
}
