import type { Category } from "@/lib/categories";

export const ICONS: Record<Category, React.ReactNode> = {
  health: (<><path d="M20.8 8.6a5 5 0 0 0-8.8-3.2 5 5 0 0 0-8.8 3.2c0 5.4 8.8 11 8.8 11s8.8-5.6 8.8-11z" /><path d="M3.5 12h4l2-3 3 6 2-3h6" /></>),
  care: (<><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12" /></>),
  purchase: (<><path d="M6 7h12l1 14H5L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>),
  home: (<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>),
  family: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>),
  other: (<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></>),
};

export function Icon({ category, size }: { category: Category; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[category]}
    </svg>
  );
}

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="11" fill="#1E1B4B" /><circle cx="18" cy="18" r="9" fill="none" stroke="#6D68C4" strokeWidth="1.6" strokeDasharray="2 3" /><path d="M18 12v6l4 2.5" stroke="#FFFFFF" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="25.5" cy="10.5" r="3.5" fill="#FF7A59" /></svg>
  );
}
