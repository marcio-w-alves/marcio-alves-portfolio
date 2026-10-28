import { ImageResponse } from 'next/og';
import { brandColors } from './brand-colors';
import { imageFonts } from './image-fonts';
import { knowledge } from './site-knowledge';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

/** Marcio's monogram, solid ink, as the browser tab shows it. */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        borderRadius: 999,
        background: brandColors.ink,
        color: brandColors.bg,
        fontFamily: 'Inter Tight',
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: 1,
      }}
    >
      {knowledge.profile.initials}
    </div>,
    { ...size, fonts: [...imageFonts] },
  );
}
