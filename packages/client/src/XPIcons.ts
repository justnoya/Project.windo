/** All icon SVG inner-HTML strings. Use inside <svg viewBox="0 0 48 48">…</svg> */

export const folder = `
  <path d="M2 11 L18 11 Q22 11 22 15 L22 17 L0 17 L0 15 Q0 11 4 11 Z" fill="#E8A000"/>
  <rect x="0" y="15" width="48" height="29" rx="3" fill="#FFD700"/>
  <rect x="1" y="16" width="46" height="10" rx="2" fill="#FFF4A0" opacity="0.55"/>
  <rect x="0" y="15" width="48" height="29" rx="3" fill="none" stroke="#C48000" stroke-width="1.5"/>
`;

export const folderOpen = `
  <path d="M2 13 L18 13 Q22 13 22 17 L22 19 L0 19 L0 17 Q0 13 4 13 Z" fill="#E8A000"/>
  <path d="M0 17 L48 17 L40 44 L-8 44 Z" fill="#FFD700"/>
  <rect x="0" y="17" width="4" height="2" fill="#C48000" opacity="0.4"/>
  <path d="M0 17 L48 17 L40 44 L-8 44 Z" fill="none" stroke="#C48000" stroke-width="1.5"/>
`;

export const mycomputer = `
  <rect x="3" y="2" width="42" height="32" rx="3" fill="#CDD8F0" stroke="#7888C0" stroke-width="1.5"/>
  <rect x="6" y="5" width="36" height="25" fill="#1040A0"/>
  <rect x="6" y="5" width="36" height="7" fill="#2860C0" opacity="0.55"/>
  <rect x="6" y="5" width="36" height="25" fill="none" stroke="#0030A0" stroke-width="0.5"/>
  <rect x="18" y="34" width="12" height="7" fill="#B0B8D0" stroke="#8090B0" stroke-width="1"/>
  <rect x="10" y="41" width="28" height="4" rx="2" fill="#A0A8C0" stroke="#7880A0" stroke-width="1"/>
  <circle cx="5" cy="33" r="1.5" fill="#44CC44"/>
`;

export const harddisk = `
  <rect x="2" y="7" width="44" height="30" rx="5" fill="#CDD5E8" stroke="#8090A8" stroke-width="1.5"/>
  <rect x="7" y="13" width="20" height="4" rx="2" fill="#8090B0"/>
  <rect x="7" y="21" width="14" height="4" rx="2" fill="#8090B0"/>
  <circle cx="37" cy="22" r="8" fill="#A8B0C8" stroke="#7080A0" stroke-width="1.5"/>
  <circle cx="37" cy="22" r="3.5" fill="#D0D8F0"/>
  <circle cx="37" cy="22" r="1.2" fill="#7880A0"/>
`;

export const xpFlag = `
  <rect x="1" y="1" width="9" height="9" rx="1.5" fill="#E83418"/>
  <rect x="12" y="1" width="9" height="9" rx="1.5" fill="#80C808"/>
  <rect x="1" y="12" width="9" height="9" rx="1.5" fill="#0060EE"/>
  <rect x="12" y="12" width="9" height="9" rx="1.5" fill="#FFD000"/>
`;

/** 16×16 nav arrow icons (use inside <svg viewBox="0 0 16 16">) */
export const arrowBack = `
  <polyline points="9,3 4,8 9,13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="4" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
`;

export const arrowFwd = `
  <polyline points="7,3 12,8 7,13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="12" y1="8" x2="3" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
`;

export const arrowUp = `
  <line x1="8" y1="2" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <polyline points="4,6 8,2 12,6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
`;

export const newFolderIcon = `
  <rect x="1" y="7" width="14" height="8" rx="1" fill="#FFD700" stroke="#C48000" stroke-width="1"/>
  <rect x="1" y="4" width="6" height="4" rx="1" fill="#E8A000"/>
  <line x1="10" y1="5" x2="14" y2="9" stroke="#006600" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="14" y1="5" x2="10" y2="9" stroke="#006600" stroke-width="1.5" stroke-linecap="round"/>
`;

export const warnIcon = `
  <polygon points="24,4 44,42 4,42" fill="#FFD000" stroke="#CC8000" stroke-width="2" stroke-linejoin="round"/>
  <rect x="22" y="16" width="4" height="14" rx="2" fill="#CC4000"/>
  <rect x="22" y="33" width="4" height="4" rx="2" fill="#CC4000"/>
`;

export const questionIcon = `
  <circle cx="24" cy="24" r="20" fill="#4488FF" stroke="#2060CC" stroke-width="2"/>
  <text x="24" y="32" text-anchor="middle" font-size="22" font-weight="bold" fill="white" font-family="Arial">?</text>
`;
