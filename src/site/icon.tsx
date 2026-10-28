import { ImageResponse } from 'next/og';
import type { ImageFonts } from './image-fonts';
import type { Brand } from './site-profile';

interface IconInput {
  readonly initials: string;
  readonly brand: Brand;
  readonly fonts: ImageFonts;
  readonly size: { readonly width: number; readonly height: number };
  /** Corner radius in pixels; a circle by default. */
  readonly radius?: number;
}

/** The owner's monogram, solid ink, as the browser tab shows it. */
export function iconImage({
  initials,
  brand: { colors, imageFont },
  fonts,
  size,
  radius = 999,
}: IconInput) {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        borderRadius: radius,
        background: colors.ink,
        color: colors.bg,
        fontFamily: imageFont.family,
        // 26px on the 64px tab icon, in proportion at any size.
        fontSize: Math.round(size.width * 0.41),
        fontWeight: 600,
        letterSpacing: 1,
      }}
    >
      {initials}
    </div>,
    { ...size, fonts },
  );
}
