export const PERMISSIONS = {
  PROJECTS: 'projects.*',
  TASKS: 'tasks.*',
  TIMESHEETS: 'timesheets.*',
  MATERIALS: 'materials.*',
  QUOTES: 'quotes.*',
  INVOICES: 'invoices.*',
  FINANCIALS: 'financials.*',
  EMPLOYEES: 'employees.*',
  SETTINGS: 'settings.*',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
