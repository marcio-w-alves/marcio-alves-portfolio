import { ImageResponse } from 'next/og';
import type { ImageFonts } from './image-fonts';
import type { Brand } from './site-profile';

interface IconInput {
  readonly initials: string;
  readonly brand: Brand;
  readonly fonts: ImageFonts;
  readonly size: { readonly width: number; readonly height: number };
}

/** The owner's monogram, solid ink, as the browser tab shows it. */
export function iconImage({ initials, brand: { colors, imageFont }, fonts, size }: IconInput) {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        borderRadius: 999,
        background: colors.ink,
        color: colors.bg,
        fontFamily: imageFont.family,
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: 1,
      }}
    >
      {initials}
    </div>,
    { ...size, fonts },
  );
}
