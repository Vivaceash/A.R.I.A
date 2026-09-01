import React from 'react';

const FileTypeIcon = ({ type, color = "currentColor", size = 48, className = "" }) => {
  // Extract up to 4 characters for the badge
  const displayType = type.substring(0, 4).toUpperCase();
  
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke={color} 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={className}
    >
      {/* File Outline */}
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      
      {/* Folded corner */}
      <polyline points="14 2 14 8 20 8" />
      
      {/* Badge background to hide the file lines behind it. */}
      {/* We use fill="var(--bg-card, #1A1A1A)" to match the card background and simulate a cutout */}
      <rect 
        x="5" 
        y="12" 
        width="14" 
        height="8" 
        rx="1" 
        fill="var(--bg-card, #1A1A1A)" 
        stroke={color} 
        strokeWidth="2" 
      />
      
      {/* Text inside the badge */}
      <text 
        x="12" 
        y="17.5" 
        textAnchor="middle" 
        fill={color} 
        stroke="none" 
        fontSize="5" 
        fontWeight="800" 
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {displayType}
      </text>
    </svg>
  );
};

export default FileTypeIcon;
