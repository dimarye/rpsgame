import React from 'react';

const baseProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const organicPath = (d) => <path d={d} {...baseProps} />;

export const gestureIcons = {
  rock: (
    <svg viewBox="0 0 64 64" className="w-full h-full text-[var(--sketch-ink)]">
      {organicPath('M18 34c-1-6 5-15 12-18s15-1 18 5 3 16-4 21-18 8-23 5-5-7-3-13z')}
      {organicPath('M29 22c1-3 5-6 8-6s5 2 6 5')}
      {organicPath('M38 21c2-2 4-3 6-2s3 4 2 7')}
    </svg>
  ),
  paper: (
    <svg viewBox="0 0 64 64" className="w-full h-full text-[var(--sketch-ink)]">
      {organicPath('M24 18l16-4 4 28-20 6z')}
      {organicPath('M24 18l-4 4 4 28 4 2')}
      {organicPath('M40 14l4 4')}
      {organicPath('M20 34l20-6')}
      {organicPath('M22 46l20-6')}
    </svg>
  ),
  scissors: (
    <svg viewBox="0 0 64 64" className="w-full h-full text-[var(--sketch-ink)]">
      {organicPath('M18 22c4-4 10-3 12 3 2 6-2 12-8 14')}
      {organicPath('M46 18L30 34')}
      {organicPath('M46 34L30 18')}
      {organicPath('M22 32c-3-3-8-1-8 4s5 8 9 6')}
      {organicPath('M42 30l8-8')}
    </svg>
  ),
};

export const GestureIcon = ({ type, className = '' }) => (
  <div className={`gesture-icon ${className}`}>
    {gestureIcons[type]}
  </div>
);

export default gestureIcons;
