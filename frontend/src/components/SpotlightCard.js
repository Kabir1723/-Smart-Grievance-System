import React, { useRef } from 'react';
import './SpotlightCard.css';

/**
 * Transparent glass "box" with a soft radial spotlight that follows the
 * cursor, adapted from the ChromaGrid hover interaction. Drop-in wrapper:
 * pass through any existing className and it keeps that element's layout,
 * it only adds the glass background + glow-on-hover behavior.
 */
const SpotlightCard = ({ children, className = '', as: Tag = 'div', ...rest }) => {
  const ref = useRef(null);

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  return (
    <Tag
      ref={ref}
      className={`spotlight-card ${className}`.trim()}
      onMouseMove={handleMove}
      {...rest}
    >
      <span className="spotlight-card__glow" />
      <span className="spotlight-card__content">{children}</span>
    </Tag>
  );
};

export default SpotlightCard;
