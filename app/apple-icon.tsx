import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  // Clock ring: 110x110, centered in 180x180 → offset 35px each side
  // Ring center: 55, 55 within ring coords
  return new ImageResponse(
    (
      <div
        style={{
          width: 180, height: 180,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #0f172a 100%)',
          borderRadius: 40,
        }}
      >
        {/* clock ring */}
        <div style={{
          width: 110, height: 110, borderRadius: '50%',
          border: '6px solid #818cf8',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {/* hour hand — points ~8 o'clock (rotate -135°) */}
          <div style={{
            position: 'absolute',
            width: 4, height: 26,
            background: 'rgba(255,255,255,0.9)',
            borderRadius: 4,
            bottom: 55,
            left: 53,
            transformOrigin: 'bottom center',
            transform: 'rotate(-135deg)',
            display: 'flex',
          }} />
          {/* minute hand — points ~12 o'clock (rotate 20°) */}
          <div style={{
            position: 'absolute',
            width: 3, height: 36,
            background: 'white',
            borderRadius: 3,
            bottom: 55,
            left: 54,
            transformOrigin: 'bottom center',
            transform: 'rotate(20deg)',
            display: 'flex',
          }} />
          {/* center dot */}
          <div style={{
            position: 'absolute',
            width: 10, height: 10, borderRadius: '50%',
            background: 'white',
            top: 50, left: 50,
            display: 'flex',
          }} />
        </div>
      </div>
    ),
    { ...size },
  )
}
