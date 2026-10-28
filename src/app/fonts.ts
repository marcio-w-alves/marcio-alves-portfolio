import { Geist_Mono, Inter, Inter_Tight } from 'next/font/google';

// The design's three faces, downloaded at build and served from this site.
// Without next/font's generated fallback, a glyph Inter lacks (the arrow in
// "6s → 3s") falls back to the system face, as it does in the design.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', adjustFontFallback: false });
const interTight = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-inter-tight',
  adjustFontFallback: false,
});
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

/** The class that defines all three font variables on the document. */
export const fontVariables = `${inter.variable} ${interTight.variable} ${geistMono.variable}`;
