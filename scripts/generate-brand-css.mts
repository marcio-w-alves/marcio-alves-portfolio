/**
 * Writes the stylesheet's colour and font tokens from the profile's brand.
 *
 * The brand is the source; the CSS is what Tailwind reads, because its theme
 * is declared in CSS. A test fails if the two drift apart.
 *
 *   pnpm brand:css
 */
import { writeFile } from 'node:fs/promises';
import { brand } from '../src/profile/brand';
import { renderBrandCss } from '../src/site/brand-css';

const OUTPUT = new URL('../src/profile/generated/brand.css', import.meta.url);

await writeFile(OUTPUT, renderBrandCss(brand));
console.log(`Wrote the brand tokens → ${OUTPUT.pathname}`);
