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
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #0f172a 100%)',
          borderRadius: 112,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* glow top-left */}
        <div style={{
          position: 'absolute', top: -50, left: -50,
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(129,140,248,0.5) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* clock ring */}
        <div style={{
          width: 310, height: 310, borderRadius: '50%',
          border: '5px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {/* arc overlay */}
          <div style={{
            position: 'absolute', inset: -16,
            borderRadius: '50%',
            border: '20px solid transparent',
            borderTopColor: '#a5b4fc',
            borderRightColor: '#818cf8',
            borderBottomColor: 'transparent',
            transform: 'rotate(-45deg)',
            display: 'flex',
          }} />

          {/* tick marks */}
          {[0, 90, 180, 270].map(deg => (
            <div key={deg} style={{
              position: 'absolute',
              width: 8, height: 24,
              background: 'rgba(255,255,255,0.7)',
              borderRadius: 4,
              transform: `rotate(${deg}deg) translateY(-130px)`,
              display: 'flex',
            }} />
          ))}

          {/* hour hand */}
          <div style={{
            position: 'absolute',
            width: 12, height: 78,
            background: 'white',
            borderRadius: 8,
            bottom: '50%',
            left: 'calc(50% - 6px)',
            transformOrigin: 'bottom center',
            transform: 'rotate(-135deg)',
            display: 'flex',
          }} />

          {/* minute hand */}
          <div style={{
            position: 'absolute',
            width: 9, height: 108,
            background: 'white',
            borderRadius: 6,
            bottom: '50%',
            left: 'calc(50% - 4.5px)',
            transformOrigin: 'bottom center',
            transform: 'rotate(30deg)',
            display: 'flex',
          }} />

          {/* center dot */}
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'white',
            display: 'flex',
          }} />
        </div>
      </div>
    ),
    { ...size },
  )
}
