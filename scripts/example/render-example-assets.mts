/**
 * Draws the example profile's placeholder photo and one-page résumé from its
 * own record, so a fork's first build serves real files at the addresses the
 * record links to. Run it after changing the example's name, title or roles.
 *
 *   pnpm exec tsx scripts/example/render-example-assets.mts
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { localize } from '../../src/core/knowledge/localize';
import type { KnowledgeSource } from '../../src/core/knowledge/schema';
import { decodeBundle } from '../profile/bundle/decode';
import { readBundleDirectory } from '../profile/bundle/read-directory';

const EXAMPLE = fileURLToPath(new URL('../../profiles/example/', import.meta.url));
const PHOTO = new URL('../../profiles/example/assets/ada-rivera.jpg', import.meta.url);
const RESUME = new URL('../../profiles/example/assets/ada-rivera-cv.pdf', import.meta.url);
const PHOTO_SIZE = 512;

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (character) => `&#${String(character.charCodeAt(0))};`);

function photoHtml(initials: string, accent: string, background: string): string {
  return `<!doctype html><html><body style="margin:0">
<div style="width:${String(PHOTO_SIZE)}px;height:${String(PHOTO_SIZE)}px;display:grid;place-items:center;
background:radial-gradient(circle at 30% 25%, ${background}, ${accent});
font:600 180px/1 Georgia, serif;color:${background};letter-spacing:-6px">${escape(initials)}</div>
</body></html>`;
}

function resumeHtml(source: KnowledgeSource): string {
  const { profile, experience, education } = localize(source, 'en');
  const roles = experience
    .map(
      (role) => `<h3>${escape(role.role)} · ${escape(role.company)}</h3>
<p class="period">${escape(role.start)} – ${escape(role.end ?? 'present')}</p>
<p>${escape(role.summary)}</p>`,
    )
    .join('\n');
  return `<!doctype html><html><head><style>
body { font: 11pt/1.45 Georgia, serif; color: #2a1d3a; margin: 0; }
h1 { font-size: 24pt; margin: 0; } h2 { font-size: 13pt; margin: 18pt 0 6pt; }
h3 { font-size: 11pt; margin: 10pt 0 0; } .period { color: #6b5d7a; margin: 0; }
.note { color: #6b5d7a; font-style: italic; margin-top: 24pt; }
</style></head><body>
<h1>${escape(profile.name)}</h1>
<p>${escape(profile.title)} · ${escape(profile.location.city ?? '')}</p>
<p>${escape(profile.summary)}</p>
<h2>Experience</h2>
${roles}
<h2>Education</h2>
<p>${escape(education.degree)} · ${escape(education.school)}</p>
<p class="note">An example résumé of a fictional person, shipped with the template.</p>
</body></html>`;
}

const { data } = decodeBundle(await readBundleDirectory(EXAMPLE));
const knowledge = data.knowledge as KnowledgeSource;
const brand = data.brand as { colors: { accent: string; bg: string } };

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: PHOTO_SIZE, height: PHOTO_SIZE } });
  await page.setContent(
    photoHtml(knowledge.profile.initials, brand.colors.accent, brand.colors.bg),
  );
  await writeFile(PHOTO, await page.screenshot({ type: 'jpeg', quality: 85 }));
  await page.setContent(resumeHtml(knowledge));
  await writeFile(
    RESUME,
    await page.pdf({
      format: 'A4',
      margin: { top: '18mm', bottom: '18mm', left: '18mm', right: '18mm' },
    }),
  );
} finally {
  await browser.close();
}
console.log(`Wrote ${PHOTO.pathname} and ${RESUME.pathname}`);
