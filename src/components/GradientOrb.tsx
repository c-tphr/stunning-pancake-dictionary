import type { CSSProperties } from 'react';

type OrbColor = 'mint' | 'peach' | 'lavender' | 'sky' | 'rose';

interface GradientOrbProps {
  color: OrbColor;
  /** Diameter in px. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

/** Pure-atmosphere decoration (DESIGN.md): never a surface, never contains content. */
export default function GradientOrb({ color, size = 480, className, style }: GradientOrbProps) {
  return (
    <div
      aria-hidden="true"
      className={['gradient-orb', className].filter(Boolean).join(' ')}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, var(--color-gradient-${color}) 0%, transparent 70%)`,
        ...style,
      }}
    />
  );
}
