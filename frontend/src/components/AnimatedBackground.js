import React from 'react';
import Scanner from './effects/Scanner';
import { useTheme } from '../context/ThemeContext';
import './AnimatedBackground.css';

// Site-wide animated backdrop. Sits fixed behind every route, uses the app's
// own palette (indigo / emerald / white) and dims itself in light mode so it
// never fights with text or card content on top of it.
const AnimatedBackground = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="animated-bg" aria-hidden="true">
      <Scanner
        color1={isDark ? '#4338ca' : '#6366f1'}
        color2={isDark ? '#10b981' : '#818cf8'}
        color3={isDark ? '#f1f5f9' : '#ffffff'}
        speed={0.35}
        sweepSpeed={0.16}
        sweepWidth={2.2}
        sweepFalloff={7}
        scale={2.2}
        frequency={1.4}
        ripple={0.18}
        bandDensity={7}
        lineSharpness={4.5}
        glow={0.16}
        scanDirection="diagonal"
        colorSpread={0.5}
        brightness={isDark ? 1.0 : 0.85}
        contrast={1.1}
        softness={1.8}
        vignette={0.55}
        scanline={false}
        grain={isDark}
        grainIntensity={0.03}
        opacity={isDark ? 0.32 : 0.16}
        mouseInteraction={false}
      />
    </div>
  );
};

export default AnimatedBackground;
