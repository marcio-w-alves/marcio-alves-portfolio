import { Geist_Mono, Inter, Inter_Tight } from 'next/font/google';

// The design's three faces, downloaded at build and served from this site.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

/** The class that defines all three font variables on the document. */
export const fontVariables = `${inter.variable} ${interTight.variable} ${geistMono.variable}`;
