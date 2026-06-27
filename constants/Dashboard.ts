export const DashboardColors = {
  sidebar: '#F0F7FF',
  sidebarHover: '#DBEAFE',
  sidebarBorder: '#BFDBFE',
  sidebarText: '#475569',
  sidebarTextActive: '#0B3B6F',
  sidebarMuted: '#64748B',
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
