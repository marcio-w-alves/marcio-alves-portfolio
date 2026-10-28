import { ImageResponse } from 'next/og';
import type { Knowledge } from '@/core/knowledge/schema';
import type { ImageFonts } from './image-fonts';
import type { Brand } from './site-profile';

interface ShareImageInput {
  readonly knowledge: Knowledge;
  readonly brand: Brand;
  readonly fonts: ImageFonts;
  readonly host: string;
  readonly size: { readonly width: number; readonly height: number };
}

// Inline styles are the renderer's only input: it lays out JSX itself, with
// no stylesheet and no Tailwind.
export function shareImage({ knowledge, brand, fonts, host, size }: ShareImageInput) {
  const { profile, welcome } = knowledge;
  const { colors, imageFont } = brand;
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: 80,
        background: colors.bg,
        color: colors.ink,
        fontFamily: imageFont.family,
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
            background: colors.ink,
            color: colors.bg,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 1.3,
          }}
        >
          {profile.initials}
        </div>
        <div style={{ fontSize: 26, color: colors['ink-muted'] }}>{host}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 112, fontWeight: 600, letterSpacing: -5, lineHeight: 1.02 }}>
          {profile.name}
        </div>
        <div style={{ marginTop: 24, fontSize: 44, color: colors['ink-muted'] }}>
          {profile.title}
        </div>
        <div
          style={{
            marginTop: 56,
            paddingTop: 32,
            borderTop: `2px solid ${colors.border}`,
            fontSize: 28,
            color: colors['ink-muted'],
          }}
        >
          {welcome.helper}
        </div>
      </div>
    </div>,
    { ...size, fonts },
  );
}
