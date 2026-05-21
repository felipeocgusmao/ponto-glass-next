import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  // Clock ring: 310x310, center at 155,155 within ring coords
  return new ImageResponse(
    (
      <div
        style={{
          width: 512, height: 512,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #0f172a 100%)',
          borderRadius: 112,
        }}
      >
        {/* clock ring */}
        <div style={{
          width: 310, height: 310, borderRadius: '50%',
          border: '16px solid #818cf8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {/* hour hand — points ~8 o'clock */}
          <div style={{
            position: 'absolute',
            width: 12, height: 74,
            background: 'rgba(255,255,255,0.9)',
            borderRadius: 8,
            bottom: 155,
            left: 149,
            transformOrigin: 'bottom center',
            transform: 'rotate(-135deg)',
            display: 'flex',
          }} />
          {/* minute hand — points ~12 o'clock */}
          <div style={{
            position: 'absolute',
            width: 9, height: 104,
            background: 'white',
            borderRadius: 6,
            bottom: 155,
            left: 151,
            transformOrigin: 'bottom center',
            transform: 'rotate(20deg)',
            display: 'flex',
          }} />
          {/* center dot */}
          <div style={{
            position: 'absolute',
            width: 28, height: 28, borderRadius: '50%',
            background: 'white',
            top: 141, left: 141,
            display: 'flex',
          }} />
        </div>
      </div>
    ),
    { ...size },
  )
}
