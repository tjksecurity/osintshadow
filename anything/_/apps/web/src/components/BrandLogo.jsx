"use client";

import React from "react";

export default function BrandLogo({
  variant = "onDark",
  className = "h-6 w-auto",
  alt = "ShadowTrace",
}) {
  // Set default color based on variant, but allow className to override via CSS cascade
  const colorClass = variant === "onDark" ? "text-white" : "text-[#263043]";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 32"
      fill="currentColor"
      className={`${colorClass} ${className}`}
      aria-label={alt}
    >
      {/* Icon: Hexagon with central node */}
      <path
        d="M16 2L28.1244 9V23L16 30L3.87564 23V9L16 2Z"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path
        d="M16 5L25.5263 10.5V21.5L16 27L6.47372 21.5V10.5L16 5Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="3.5" fill="currentColor" />

      {/* Text: ShadowTrace */}
      <text
        x="36"
        y="23"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="bold"
        fontSize="21"
        fill="currentColor"
      >
        ShadowTrace
      </text>
    </svg>
  );
}
