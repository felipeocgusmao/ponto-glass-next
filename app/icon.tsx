import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
          borderRadius: 0,
        }}
      >
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: '50%',
            border: '20px solid rgba(255,255,255,0.30)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 168,
              fontWeight: 800,
              color: 'white',
              fontFamily: 'sans-serif',
              letterSpacing: -8,
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
