export const DashboardColors = {
  sidebar: '#0F172A',
  sidebarHover: '#1E293B',
  sidebarBorder: 'rgba(255,255,255,0.08)',
  sidebarText: '#94A3B8',
  sidebarTextActive: '#FFFFFF',
  pageBg: '#F1F5F9',
  topbarBg: '#FFFFFF',
  topbarBorder: '#E2E8F0',
  accent: '#1f79eb',
  accentLight: '#4a96f5',
  danger: '#E63946',
  success: '#10B981',
} as const;

export const DASHBOARD_SIDEBAR_WIDTH = 272;
export const DASHBOARD_SIDEBAR_MARGIN = 16;
export const DASHBOARD_SIDEBAR_RADIUS = 20;
/** Espace horizontal réservé à la sidebar flottante + marges */
export const DASHBOARD_SIDEBAR_OFFSET =
  DASHBOARD_SIDEBAR_WIDTH + DASHBOARD_SIDEBAR_MARGIN * 2;
