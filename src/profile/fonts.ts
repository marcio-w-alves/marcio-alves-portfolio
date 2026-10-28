import { Geist_Mono, Inter, Inter_Tight } from 'next/font/google';

// The design's three faces, downloaded at build and served from this site.
// next/font requires literal options, which is why the faces are named here
// and not in brand.ts. Without its generated fallback, a glyph the text face
// lacks (the arrow in "6s → 3s") falls back to the system face, as it does in
// the design.
const text = Inter({ subsets: ['latin'], variable: '--font-face-text', adjustFontFallback: false });
const display = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-face-display',
  adjustFontFallback: false,
});
const code = Geist_Mono({ subsets: ['latin'], variable: '--font-face-code' });

/** The class that defines the three face variables the stylesheet's font tokens read. */
export const fontClassName = `${text.variable} ${display.variable} ${code.variable}`;
