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
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #0f172a 100%)',
          borderRadius: 40,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* glow top-left */}
        <div style={{
          position: 'absolute', top: -20, left: -20,
          width: 120, height: 120, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(129,140,248,0.5) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* clock ring */}
        <div style={{
          width: 110, height: 110, borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {/* arc overlay — top 3/4 in indigo */}
          <div style={{
            position: 'absolute', inset: -6,
            borderRadius: '50%',
            border: '7px solid transparent',
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
              width: 3, height: 9,
              background: 'rgba(255,255,255,0.7)',
              borderRadius: 2,
              transform: `rotate(${deg}deg) translateY(-46px)`,
              display: 'flex',
            }} />
          ))}

          {/* hour hand ~8 o'clock */}
          <div style={{
            position: 'absolute',
            width: 4, height: 28,
            background: 'white',
            borderRadius: 4,
            bottom: '50%',
            left: 'calc(50% - 2px)',
            transformOrigin: 'bottom center',
            transform: 'rotate(-135deg)',
            display: 'flex',
          }} />

          {/* minute hand ~12 o'clock */}
          <div style={{
            position: 'absolute',
            width: 3, height: 38,
            background: 'white',
            borderRadius: 3,
            bottom: '50%',
            left: 'calc(50% - 1.5px)',
            transformOrigin: 'bottom center',
            transform: 'rotate(30deg)',
            display: 'flex',
          }} />

          {/* center dot */}
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: 'white',
            display: 'flex',
          }} />
        </div>
      </div>
    ),
    { ...size },
  )
}
