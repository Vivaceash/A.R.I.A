import React from 'react';

const PdfIcon = ({ size = 22, color = '#EF4444', className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    {/* Page base with folded corner */}
    <path
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 2v6h6"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Red PDF Badge */}
    <rect
      x="4.2"
      y="11.2"
      width="15.6"
      height="7.6"
      rx="1.8"
      fill={color}
    />
    {/* Bold PDF Label */}
    <text
      x="12"
      y="17"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="5"
      fontWeight="900"
      fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      letterSpacing="0.5"
    >
      PDF
    </text>
  </svg>
);

export default PdfIcon;
