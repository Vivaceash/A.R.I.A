import React from 'react';

const DocIcon = ({ size = 22, color = '#3B82F6', label = 'DOC', className = '' }) => {
  const isFour = label.length >= 4;
  return (
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
      {/* Blue DOC Badge */}
      <rect
        x={isFour ? '3.8' : '4.2'}
        y="11.2"
        width={isFour ? '16.4' : '15.6'}
        height="7.6"
        rx="1.8"
        fill={color}
      />
      {/* Bold DOC / DOCX Label */}
      <text
        x="12"
        y={isFour ? '16.9' : '17'}
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize={isFour ? '4.2' : '5'}
        fontWeight="900"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        letterSpacing={isFour ? '0.3' : '0.5'}
      >
        {label}
      </text>
    </svg>
  );
};

export default DocIcon;
