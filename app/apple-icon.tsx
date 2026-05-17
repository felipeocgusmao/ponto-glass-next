import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
        }}
      >
        <div
          style={{
            width: 126,
            height: 126,
            borderRadius: '50%',
            border: '8px solid rgba(255,255,255,0.30)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 58,
              fontWeight: 800,
              color: 'white',
              fontFamily: 'sans-serif',
              letterSpacing: -3,
            }}
          >
            PG
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
