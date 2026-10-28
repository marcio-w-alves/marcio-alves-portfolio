import { ImageResponse } from 'next/og';
import { siteUrl } from '@/env';
import { brandColors } from './brand-colors';
import { imageFonts } from './image-fonts';
import { knowledge } from './site-knowledge';

const { profile, welcome } = knowledge;

export const alt = `${profile.name}, ${profile.title}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Inline styles are the renderer's only input: it lays out JSX itself, with
// no stylesheet and no Tailwind.
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: 80,
        background: brandColors.bg,
        color: brandColors.ink,
        fontFamily: 'Inter Tight',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 999,
            background: brandColors.ink,
            color: brandColors.bg,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 1.3,
          }}
        >
          {profile.initials}
        </div>
        <div style={{ fontSize: 26, color: brandColors['ink-muted'] }}>{siteUrl().host}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 112, fontWeight: 600, letterSpacing: -5, lineHeight: 1.02 }}>
          {profile.name}
        </div>
        <div style={{ marginTop: 24, fontSize: 44, color: brandColors['ink-muted'] }}>
          {profile.title}
        </div>
        <div
          style={{
            marginTop: 56,
            paddingTop: 32,
            borderTop: `2px solid ${brandColors.border}`,
            fontSize: 28,
            color: brandColors['ink-muted'],
          }}
        >
          {welcome.helper}
        </div>
      </div>
    </div>,
    { ...size, fonts: [...imageFonts] },
  );
}
