import React from 'react';

// THE THING star, with the straight route splitting into two wobble paths
// tucked underneath it.
const BrandMark = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <rect x="1.5" y="1.5" width="29" height="29" rx="9" fill="#120b26" stroke="#120b26" strokeWidth="3" />
    <path d="M16 4.4l2.3 7.5L25.8 14l-7.5 2.1L16 23.6l-2.3-7.5L6.2 14l7.5-2.1Z" fill="#ffd23f" />
    <path d="M8.5 27C12 27 12 22.5 16 22.5" stroke="#ff4d8d" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M16 22.5C20 22.5 20 27 23.5 27" stroke="#b79cff" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export default BrandMark;
