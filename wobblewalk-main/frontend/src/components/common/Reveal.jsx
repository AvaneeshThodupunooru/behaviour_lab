import React from 'react';
import { useReveal } from '../../hooks/useInteractions.js';

const Reveal = ({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) => {
  const ref = useReveal(delay);
  return React.createElement(Tag, { ref, className: `reveal ${className}`, ...rest }, children);
};

export default Reveal;
