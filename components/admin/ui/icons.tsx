import type { SVGProps } from "react";

/**
 * Set de iconografía SVG profesional (trazo, hereda currentColor).
 * Reemplaza cualquier emoji/emoticono de la interfaz por símbolos consistentes.
 * Uso: <Icon name="search" className="h-4 w-4" />
 */

export type IconName =
  | "search"
  | "cart"
  | "sparkles"
  | "menu"
  | "filter"
  | "star"
  | "star-filled"
  | "heart"
  | "heart-filled"
  | "check"
  | "x"
  | "pencil"
  | "gear"
  | "warning"
  | "phone"
  | "map-pin"
  | "package"
  | "truck"
  | "receipt"
  | "users"
  | "chef-hat"
  | "glass"
  | "coffee"
  | "tools"
  | "cube"
  | "image"
  | "clock"
  | "dollar"
  | "calendar"
  | "tag"
  | "document"
  | "file"
  | "upload"
  | "download"
  | "copy"
  | "link"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up"
  | "arrow-down"
  | "sort"
  | "grid"
  | "list"
  | "cards"
  | "panels"
  | "plate"
  | "repeat"
  | "edit"
  | "wallet"
  | "printer"
  | "music"
  | "beer"
  | "inbox"
  | "eye"
  | "external-link"
  | "logout"
  | "user"
  | "alert-triangle"
  | "check-circle"
  | "loader"
  | "location"
  | "refresh"
  | "money"
  | "save"
  | "mail"
  | "flame"
  | "wifi-off"
  | "trash"
  | "plus";

const paths: Record<IconName, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 3h2l2.6 12.4a1.8 1.8 0 0 0 1.8 1.4h7.6a1.8 1.8 0 0 0 1.7-1.3L21 7H6"/>',
  sparkles:
    '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M19 15l.8 1.9 1.9.8-1.9.8L19 20.4l-.8-1.9-1.9-.8 1.9-.8L19 15z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5z"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.8 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z"/>',
  "star-filled":
    '<path fill="currentColor" d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.8 6.4 20.2l1.1-6.2L3 9.6l6.2-.9L12 3z"/>',
  heart: '<path d="M12 20s-7-4.4-9.2-8.5A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9.2 4.9C19 15.6 12 20 12 20z"/>',
  "heart-filled":
    '<path fill="currentColor" d="M12 20s-7-4.4-9.2-8.5A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9.2 4.9C19 15.6 12 20 12 20z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  pencil: '<path d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  warning: '<path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4M12 17.5v.5"/>',
  phone:
    '<path d="M5 4h4l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  "map-pin":
    '<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  package: '<path d="M12 3 4 7v10l8 4 8-4V7l-8-4z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  truck:
    '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  receipt: '<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z"/><path d="M9 8h6M9 12h6"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.3a3.2 3.2 0 0 1 0 5.4M18 14c2.5.8 4 2.9 4 6"/>',
  "chef-hat":
    '<path d="M6 15a4 4 0 0 1-1.5-7.7A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 7.5 1.3A4 4 0 0 1 18 15v4H6v-4z"/><path d="M6 16h12"/>',
  glass: '<path d="M7 3h10l-1 17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2L7 3z"/><path d="M7.5 11h9"/>',
  coffee:
    '<path d="M4 8h11v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z"/><path d="M15 10h1.5a2.5 2.5 0 0 1 0 5H15M4 19h11M7 6V4M10 6V4M13 6V4"/>',
  tools: '<path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L4 17l3 3 4.7-4.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7z"/>',
  cube: '<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  image:
    '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l4.5-4.5 3 3L16 11l4 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  dollar:
    '<circle cx="12" cy="12" r="9"/><path d="M12 6v12M15.5 8.5c-.8-1-2.1-1.6-3.5-1.6-2 0-3.5 1-3.5 2.6 0 3.7 7 1.6 7 5.1 0 1.6-1.5 2.6-3.5 2.6-1.4 0-2.7-.6-3.5-1.6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  tag: '<path d="M3 3h7l11 11-7 7L3 10V3z"/><circle cx="8" cy="8" r="1.4"/>',
  document: '<path d="M6 3h9l4 4v14H6V3z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z"/><path d="M14 3v5h5"/>',
  upload: '<path d="M12 16V5M8 9l4-4 4 4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  download: '<path d="M12 5v11M8 12l4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
  "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
  "arrow-up": '<path d="M12 19V5M6 11l6-6 6 6"/>',
  "arrow-down": '<path d="M12 5v14M6 13l6 6 6-6"/>',
  sort: '<path d="M7 3v18M3 7l4-4 4 4M17 21V3M13 17l4 4 4-4"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16M8 6v.01M8 12v.01M8 18v.01"/>',
  cards: '<rect x="4" y="4" width="16" height="9" rx="2"/><path d="M4 16h6M12 16h2M16 18h4M4 19h6"/>',
  panels: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 10v10"/>',
  plate: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
  repeat:
    '<path d="M3 12a9 9 0 0 1 15.5-6.5L21 8M21 12a9 9 0 0 1-15.5 6.5L3 16"/><path d="M17 3l4 5h-4M7 21l-4-5h4"/>',
  edit: '<path d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z"/>',
  wallet:
    '<path d="M4 6a2 2 0 0 1 2-2h13v4"/><path d="M4 6v12a2 2 0 0 0 2 2h13V8h-2a4 4 0 0 0-4 4 4 4 0 0 0 4 4h2"/><path d="M17 12h.01"/>',
  printer:
    '<path d="M6 9V3h12v6"/><path d="M6 15h12a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2z"/><path d="M6 19h12v-4H6v4z"/>',
  music: '<path d="M9 18V5l10-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  beer: '<path d="M7 4h8v6a4 4 0 0 1-4 4 4 4 0 0 1-4-4V4z"/><path d="M9 4v2M12 4v2M15 4v2M15 9h1.5a2 2 0 0 1 0 4H15M6 20h9M9 14v6M12 14v6"/>',
  inbox:
    '<path d="M3 13h5l2 3h4l2-3h5l-1.5 6a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 13z"/><path d="M3 13V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  "external-link":
    '<path d="M14 4h6v6M20 4 10 14"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  logout: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M15 8l4 4-4 4M19 12H9"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"/>',
  "alert-triangle": '<path d="M12 4 2.5 20h19L12 4z"/><path d="M12 10v4M12 17.5v.5"/>',
  "check-circle": '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>',
  loader:
    '<path d="M12 3v4M12 17v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M3 12h4M17 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
  location: '<path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3v4h-4"/>',
  money:
    '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9v6M17.5 9v6"/>',
  save: '<path d="M5 3h11l5 5v13H5V3z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  flame:
    '<path d="M12 3c.5 3.5-3 5-3 8a3 3 0 0 0 6 0c0-1.5-.7-2.5-1.3-3.5.8 1 3 2.4 3 5.5A5.5 5.5 0 0 1 12 21a5.5 5.5 0 0 1-5.5-5.5c0-4 3.5-6 5.5-9z"/>',
  "wifi-off":
    '<path d="M2 8.5a15 15 0 0 1 6.5-3.7M9.5 5.2A15 15 0 0 1 22 8.5M5 12a10 10 0 0 1 3.5-2.6M12.5 9a10 10 0 0 1 6.5 3"/><path d="M8.5 15.5a5.5 5.5 0 0 1 7 0M12 19h.01M3 3l18 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
      dangerouslySetInnerHTML={{ __html: paths[name] }}
    />
  );
}
