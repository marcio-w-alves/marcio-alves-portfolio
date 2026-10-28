import { site } from '@/site-root';

export const generateStaticParams = site.localeParams;

// Read when the module loads, not inside the handler: a file read there would
// make the image render on every request instead of once, at build.
const fonts = await site.imageFonts();

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly locale: string }> },
) {
  return site.shareImage((await params).locale, fonts);
}
