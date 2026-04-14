import fs from 'node:fs';
import path from 'node:path';

const baseInfo = {
  info: {
    name: 'BuilderPro Full API Collection',
    description:
      'Comprehensive collection for all /api/v1 endpoints. Includes sample request payloads and sample JSON responses based on DTOs and controller/service return shapes.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3005/api/v1' },
    { key: 'accessToken', value: '' },
    { key: 'refreshToken', value: '' },
    { key: 'tenantSlug', value: 'builder-pro-demo' },
    { key: 'projectId', value: 'cm9v0pr0j0001abc' },
    { key: 'taskId', value: 'cm9v0task0001abc' },
    { key: 'invoiceId', value: 'cm9v0invoice0001abc' },
    { key: 'quoteId', value: 'cm9v0quote0001abc' },
    { key: 'employeeId', value: 'cm9v0emp0001abc' },
    { key: 'clientId', value: 'cm9v0client0001abc' },
    { key: 'conversationId', value: 'cm9v0conv0001abc' },
    { key: 'userId', value: 'cm9v0usr0001abc' },
    { key: 'platformAdminEmail', value: 'platform-admin@builderpro.local' },
    { key: 'platformAdminPassword', value: 'PlatformAdmin123!' },
    { key: 'platformAdminToken', value: '' },
    { key: 'platformAdminApiKey', value: 'change-me-platform-admin-key' },
  ],
  item: [],
};

const headers = {
  tenantBearer: [
    { key: 'Authorization', value: 'Bearer {{accessToken}}' },
    { key: 'x-tenant-slug', value: '{{tenantSlug}}' },
  ],
  tenantBearerJson: [
    { key: 'Authorization', value: 'Bearer {{accessToken}}' },
    { key: 'x-tenant-slug', value: '{{tenantSlug}}' },
    { key: 'Content-Type', value: 'application/json' },
  ],
  publicJson: [{ key: 'Content-Type', value: 'application/json' }],
  public: [],
  platformBearer: [
    { key: 'Authorization', value: 'Bearer {{platformAdminToken}}' },
    { key: 'Content-Type', value: 'application/json' },
  ],
  platformKey: [
    { key: 'x-platform-admin-key', value: '{{platformAdminApiKey}}' },
    { key: 'Content-Type', value: 'application/json' },
  ],
};

const bodyTemplates = {
  register: {
    firstName: 'Blessing',
    lastName: 'Moyo',
    email: 'owner@builderpro.local',
    password: 'ChangeMe123!',
    companySlug: 'builder-pro-demo',
    phone: '+263771234567',
  },
  login: { email: 'owner@builderpro.local', password: 'ChangeMe123!', companySlug: 'builder-pro-demo' },
  refresh: { refreshToken: '{{refreshToken}}' },
  invite: { email: 'new.user@builderpro.local', firstName: 'New', lastName: 'User', role: 'Worker' },
  acceptInvite: { token: 'invite-token-from-email', password: 'ChangeMe123!' },
  updateProfile: { firstName: 'Blessing', lastName: 'Moyo', phone: '+263771234567' },
  updateCompany: { name: 'Builder Pro Zimbabwe', countryCode: 'ZW', defaultCurrency: 'USD', timezone: 'Africa/Harare' },
  createProject: { code: 'PRJ-2026-001', name: 'Harare Mall Fit-out', description: 'Interior civil works and finishes', status: 'ACTIVE', startDate: '2026-04-05', endDate: '2026-07-20', baselineBudget: 120000, clientId: '{{clientId}}' },
  updateProject: { name: 'Harare Mall Fit-out Phase 1', status: 'ON_HOLD', completionPercent: 45 },
  addProjectMember: { userId: '{{userId}}', role: 'Project Manager' },
  createTask: { projectId: '{{projectId}}', title: 'Cast slab level 1', description: 'Complete rebar and concrete pour', status: 'TODO', priority: 'HIGH', startDate: '2026-04-10', dueDate: '2026-04-13', estimatedHours: 16.5, assigneeIds: ['{{userId}}'] },
  updateTask: { title: 'Cast slab level 1 - updated', priority: 'CRITICAL', dueDate: '2026-04-14' },
  updateTaskStatus: { status: 'IN_PROGRESS' },
  createComment: { content: 'Shuttering complete, waiting concrete truck.' },
  createChecklist: { title: 'Pre-pour checks', items: ['Rebar spacing verified', 'Formwork aligned', 'Vibrator available'] },
  createDocument: { fileKey: 'projects/{{projectId}}/site-photo-001.jpg', fileName: 'site-photo-001.jpg', contentType: 'image/jpeg', sizeBytes: 235900, projectId: '{{projectId}}', type: 'PHOTO' },
  createMaterial: { name: 'Cement 32.5N', sku: 'CEM-32-001', unit: 'bag', unitCost: 12.5, supplierId: 'cm9v0supplier0001abc' },
  updateMaterial: { name: 'Cement 42.5N', reorderAt: 20, unitCost: 13.2 },
  adjustStock: { quantity: 50.0 },
  logMaterialUsage: { projectId: '{{projectId}}', materialId: 'cm9v0mat0001abc', quantity: 120.75, unitCost: 11.2, supplierId: 'cm9v0supplier0001abc', notes: 'Used for slab pour at block A' },
  createSupplier: { name: 'BuildMart Supplies', email: 'orders@buildmart.co.zw', phone: '+263772000111', address: 'Harare' },
  createQuote: { clientId: '{{clientId}}', projectId: '{{projectId}}', title: 'Quotation for phase 1', issueDate: '2026-04-02', expiryDate: '2026-04-16', lineItems: [{ category: 'Labour', description: 'Masons', quantity: 24, unitPrice: 15.5 }] },
  updateQuote: { title: 'Updated quotation title', expiryDate: '2026-04-20' },
  rejectWithNotes: { notes: 'Price exceeds budget, please revise.' },
  createVariation: { title: 'Additional retaining wall', notes: 'Client requested extension', amount: 4500 },
  createInvoice: { clientId: '{{clientId}}', projectId: '{{projectId}}', quoteId: '{{quoteId}}', issueDate: '2026-04-02', dueDate: '2026-04-12', lineItems: [{ description: 'Concrete works milestone 1', quantity: 1, unitPrice: 3500 }] },
  updateInvoice: { dueDate: '2026-04-15', notes: 'Updated payment terms' },
  recordPayment: { method: 'PAYNOW', amount: 1500 },
  createEmployee: { userId: '{{userId}}', employeeCode: 'EMP-0004', jobTitle: 'Foreman', employmentType: 'Full-time', hourlyRate: 12.5, startDate: '2026-03-15' },
  updateEmployee: { jobTitle: 'Senior Foreman', hourlyRate: 14.0 },
  employeeStatus: { isActive: true },
  createBudgetCategory: { code: 'LAB', name: 'Labour' },
  setProjectBudget: { projectId: '{{projectId}}', categories: [{ code: 'LAB', plannedAmount: 25000 }, { code: 'MAT', plannedAmount: 40000 }], thresholdPct: 80 },
  createTransaction: { projectId: '{{projectId}}', categoryCode: 'MAT', amount: 1850.75, description: 'Purchased reinforcement bars', occurredAt: '2026-04-03T08:00:00.000Z' },
  clockIn: { projectId: '{{projectId}}', taskId: '{{taskId}}', gpsInLat: -17.8249, gpsInLng: 31.053 },
  clockOut: { breakMinutes: 30, gpsOutLat: -17.825, gpsOutLng: 31.0532 },
  manualTimeEntry: { projectId: '{{projectId}}', workerId: '{{userId}}', clockInAt: '2026-04-01T08:00:00.000Z', clockOutAt: '2026-04-01T17:00:00.000Z', breakMinutes: 30, notes: 'Manual backfill' },
  approveTimeEntry: { status: 'APPROVED', approvalComment: 'Approved after site supervisor review' },
  createClient: { name: 'Acme Properties', email: 'projects@acme.co.zw', phone: '+263772000111', address: 'Samora Machel Ave, Harare', notes: 'VIP client' },
    updateClient: { name: 'Acme Properties Pvt Ltd', email: 'projects@acme.co.zw', phone: '+263772000222', address: 'Borrowdale, Harare' },
  createConversation: { type: 'PROJECT', projectId: '{{projectId}}', participantIds: ['{{userId}}'] },
  sendMessage: { conversationId: '{{conversationId}}', body: 'Please confirm slab pour is ready for tomorrow.' },
  markNotificationRead: { isRead: true },
  changePlan: { planCode: 'PRO_MONTHLY' },
  paynowInitiate: { invoiceId: '{{invoiceId}}', amount: 1500, currency: 'USD', payerEmail: 'payer@example.com' },
  generateReport: { reportType: 'project-cost-summary', filters: { projectId: '{{projectId}}', from: '2026-04-01', to: '2026-04-30' } },
  onboardingRegister: {
    companyName: 'Acme Construction',
    industry: 'Construction',
    accountType: 'COMPANY',
    defaultCurrency: 'USD',
    countryCode: 'ZW',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@acme.local',
    phone: '+263771234567',
    password: 'Password123#',
    planCode: 'ENTERPRISE',
  },
  activateSubscription: { planCode: 'PRO_MONTHLY' },
  platformLogin: { email: '{{platformAdminEmail}}', password: '{{platformAdminPassword}}' },
  rotateApiKey: { reason: 'Quarterly key rotation' },
  updateCompanyApproval: { isActive: true },
  updateSubscriptionStatus: { status: 'ACTIVE' },
  createRole: { name: 'Site Supervisor', description: 'Supervises site operations' },
  updateRole: { name: 'Site Supervisor', description: 'Updated role description' },
  assignPermissions: { permissionKeys: ['projects.view', 'tasks.*'] },
  assignRoleToUser: { roleId: 'cm9v0role0001abc' },
};

const responseTemplates = {
  ok: { success: true },
  authTokens: { accessToken: 'eyJhbGciOi...tenant', refreshToken: 'eyJhbGciOi...refresh', tokenType: 'Bearer', expiresIn: '15m' },
  platformAuthTokens: { tokenType: 'Bearer', expiresIn: '12h', accessToken: 'eyJhbGciOi...platform', admin: { id: 'cm9v0padm0001', email: 'platform-admin@builderpro.local', displayName: 'Platform Admin' } },
  listMeta: { items: [], meta: { page: 1, limit: 20, total: 0 } },
  company: { id: 'cm9v0co0001', name: 'Builder Pro Demo', slug: 'builder-pro-demo', isActive: true },
  project: { id: 'cm9v0pr0j0001abc', code: 'PRJ-2026-001', name: 'Harare Mall Fit-out', status: 'ACTIVE', baselineBudget: 120000 },
  task: { id: 'cm9v0task0001abc', title: 'Cast slab level 1', status: 'IN_PROGRESS', priority: 'HIGH' },
  invoice: { id: 'cm9v0invoice0001abc', invoiceNumber: 'INV-2026-0001', status: 'SENT', totalAmount: 3500, paidAmount: 0, balanceAmount: 3500 },
  quote: { id: 'cm9v0quote0001abc', quoteNumber: 'Q-2026-0001', status: 'DRAFT', totalAmount: 372 },
  material: { id: 'cm9v0mat0001abc', name: 'Cement 32.5N', unit: 'bag', unitCost: 12.5, stockOnHand: 200 },
  employee: { id: 'cm9v0emp0001abc', employeeCode: 'EMP-0004', jobTitle: 'Foreman', isActive: true },
  message: { id: 'cm9v0msg0001abc', conversationId: 'cm9v0conv0001abc', body: 'Please confirm slab pour is ready for tomorrow.' },
  overview: { companies: { total: 42, pendingApprovals: 4 }, subscriptions: { active: 38 }, payments: { pending: 6, success: 120, failed: 2 } },
};

const endpoints = [
  ['App', 'GET', '/', 'public', null, 'ok'],
  ['Auth', 'POST', '/auth/register', 'publicJson', 'register', 'authTokens'],
  ['Auth', 'POST', '/auth/login', 'publicJson', 'login', 'authTokens'],
  ['Auth', 'POST', '/auth/refresh', 'publicJson', 'refresh', 'authTokens'],
  ['Auth', 'GET', '/auth/me', 'tenantBearer', null, 'ok'],
  ['Auth', 'POST', '/auth/invite', 'tenantBearerJson', 'invite', 'ok'],
  ['Auth', 'POST', '/auth/accept-invite', 'publicJson', 'acceptInvite', 'authTokens'],

  ['Users', 'GET', '/users?page=1&limit=20&search=', 'tenantBearer', null, 'listMeta'],
  ['Users', 'GET', '/users/me', 'tenantBearer', null, 'ok'],
  ['Users', 'PUT', '/users/me', 'tenantBearerJson', 'updateProfile', 'ok'],
  ['Users', 'GET', '/users/{{userId}}', 'tenantBearer', null, 'ok'],
  ['Users', 'PUT', '/users/{{userId}}', 'tenantBearerJson', 'updateProfile', 'ok'],
  ['Users', 'PUT', '/users/{{userId}}/deactivate', 'tenantBearer', null, 'ok'],
  ['Users', 'PUT', '/users/{{userId}}/activate', 'tenantBearer', null, 'ok'],

  ['Companies', 'GET', '/companies/me', 'tenantBearer', null, 'company'],
  ['Companies', 'PATCH', '/companies/me', 'tenantBearerJson', 'updateCompany', 'company'],

  ['Projects', 'POST', '/projects', 'tenantBearerJson', 'createProject', 'project'],
  ['Projects', 'GET', '/projects?page=1&limit=20&search=', 'tenantBearer', null, 'listMeta'],
  ['Projects', 'GET', '/projects/{{projectId}}', 'tenantBearer', null, 'project'],
  ['Projects', 'GET', '/projects/{{projectId}}/dashboard', 'tenantBearer', null, 'ok'],
  ['Projects', 'PUT', '/projects/{{projectId}}', 'tenantBearerJson', 'updateProject', 'project'],
  ['Projects', 'DELETE', '/projects/{{projectId}}', 'tenantBearer', null, 'ok'],
  ['Projects', 'GET', '/projects/{{projectId}}/members', 'tenantBearer', null, 'listMeta'],
  ['Projects', 'POST', '/projects/{{projectId}}/members', 'tenantBearerJson', 'addProjectMember', 'ok'],
  ['Projects', 'DELETE', '/projects/{{projectId}}/members/{{userId}}', 'tenantBearer', null, 'ok'],

  ['Tasks', 'POST', '/tasks', 'tenantBearerJson', 'createTask', 'task'],
  ['Tasks', 'GET', '/tasks?projectId={{projectId}}&page=1&limit=20', 'tenantBearer', null, 'listMeta'],
  ['Tasks', 'GET', '/tasks/my-queue', 'tenantBearer', null, 'listMeta'],
  ['Tasks', 'GET', '/tasks/{{taskId}}', 'tenantBearer', null, 'task'],
  ['Tasks', 'PUT', '/tasks/{{taskId}}', 'tenantBearerJson', 'updateTask', 'task'],
  ['Tasks', 'PUT', '/tasks/{{taskId}}/status', 'tenantBearerJson', 'updateTaskStatus', 'task'],
  ['Tasks', 'DELETE', '/tasks/{{taskId}}', 'tenantBearer', null, 'ok'],
  ['Tasks', 'POST', '/tasks/{{taskId}}/assignees/{{userId}}', 'tenantBearer', null, 'ok'],
  ['Tasks', 'DELETE', '/tasks/{{taskId}}/assignees/{{userId}}', 'tenantBearer', null, 'ok'],
  ['Tasks', 'GET', '/tasks/{{taskId}}/comments', 'tenantBearer', null, 'listMeta'],
  ['Tasks', 'POST', '/tasks/{{taskId}}/comments', 'tenantBearerJson', 'createComment', 'ok'],
  ['Tasks', 'POST', '/tasks/{{taskId}}/checklists', 'tenantBearerJson', 'createChecklist', 'ok'],
  ['Tasks', 'PUT', '/tasks/{{taskId}}/checklists/cm9v0chk0001/items/cm9v0it0001/toggle', 'tenantBearer', null, 'ok'],

  ['Documents', 'POST', '/documents', 'tenantBearerJson', 'createDocument', 'ok'],
  ['Documents', 'GET', '/documents?page=1&limit=20', 'tenantBearer', null, 'listMeta'],
  ['Documents', 'GET', '/documents/cm9v0doc0001abc', 'tenantBearer', null, 'ok'],
  ['Documents', 'GET', '/documents/cm9v0doc0001abc/download-url', 'tenantBearer', null, 'ok'],
  ['Documents', 'DELETE', '/documents/cm9v0doc0001abc', 'tenantBearer', null, 'ok'],

  ['Materials', 'POST', '/materials', 'tenantBearerJson', 'createMaterial', 'material'],
  ['Materials', 'GET', '/materials?page=1&limit=20', 'tenantBearer', null, 'listMeta'],
  ['Materials', 'GET', '/materials/low-stock', 'tenantBearer', null, 'listMeta'],
  ['Materials', 'GET', '/materials/logs?page=1&limit=20', 'tenantBearer', null, 'listMeta'],
  ['Materials', 'GET', '/materials/cm9v0mat0001abc', 'tenantBearer', null, 'material'],
  ['Materials', 'PUT', '/materials/cm9v0mat0001abc', 'tenantBearerJson', 'updateMaterial', 'material'],
  ['Materials', 'PUT', '/materials/cm9v0mat0001abc/stock-adjust', 'tenantBearerJson', 'adjustStock', 'material'],
  ['Materials', 'DELETE', '/materials/cm9v0mat0001abc', 'tenantBearer', null, 'ok'],
  ['Materials', 'POST', '/materials/usage', 'tenantBearerJson', 'logMaterialUsage', 'ok'],
  ['Materials', 'POST', '/materials/suppliers', 'tenantBearerJson', 'createSupplier', 'ok'],
  ['Materials', 'GET', '/materials/suppliers/list?page=1&limit=20', 'tenantBearer', null, 'listMeta'],
  ['Materials', 'DELETE', '/materials/suppliers/cm9v0supplier0001abc', 'tenantBearer', null, 'ok'],

  ['Quotes', 'POST', '/quotes', 'tenantBearerJson', 'createQuote', 'quote'],
  ['Quotes', 'GET', '/quotes?page=1&limit=20', 'tenantBearer', null, 'listMeta'],
  ['Quotes', 'GET', '/quotes/{{quoteId}}', 'tenantBearer', null, 'quote'],
  ['Quotes', 'PUT', '/quotes/{{quoteId}}', 'tenantBearerJson', 'updateQuote', 'quote'],
  ['Quotes', 'PUT', '/quotes/{{quoteId}}/send', 'tenantBearer', null, 'quote'],
  ['Quotes', 'PUT', '/quotes/{{quoteId}}/approve', 'tenantBearer', null, 'quote'],
  ['Quotes', 'PUT', '/quotes/{{quoteId}}/reject', 'tenantBearerJson', 'rejectWithNotes', 'quote'],
  ['Quotes', 'PUT', '/quotes/{{quoteId}}/convert', 'tenantBearer', null, 'quote'],
  ['Quotes', 'DELETE', '/quotes/{{quoteId}}', 'tenantBearer', null, 'ok'],
  ['Quotes', 'POST', '/quotes/variations/{{projectId}}', 'tenantBearerJson', 'createVariation', 'ok'],
  ['Quotes', 'GET', '/quotes/variations/{{projectId}}', 'tenantBearer', null, 'listMeta'],
  ['Quotes', 'PUT', '/quotes/variations/cm9v0var0001abc/approve', 'tenantBearer', null, 'ok'],
  ['Quotes', 'PUT', '/quotes/variations/cm9v0var0001abc/reject', 'tenantBearerJson', 'rejectWithNotes', 'ok'],

  ['Invoices', 'POST', '/invoices', 'tenantBearerJson', 'createInvoice', 'invoice'],
  ['Invoices', 'GET', '/invoices?page=1&limit=20', 'tenantBearer', null, 'listMeta'],
  ['Invoices', 'GET', '/invoices/aging-report', 'tenantBearer', null, 'ok'],
  ['Invoices', 'GET', '/invoices/{{invoiceId}}', 'tenantBearer', null, 'invoice'],
  ['Invoices', 'GET', '/invoices/{{invoiceId}}/statement', 'tenantBearer', null, 'ok'],
  ['Invoices', 'PUT', '/invoices/{{invoiceId}}', 'tenantBearerJson', 'updateInvoice', 'invoice'],
  ['Invoices', 'PUT', '/invoices/{{invoiceId}}/send', 'tenantBearer', null, 'invoice'],
  ['Invoices', 'PUT', '/invoices/{{invoiceId}}/void', 'tenantBearer', null, 'invoice'],
  ['Invoices', 'DELETE', '/invoices/{{invoiceId}}', 'tenantBearer', null, 'ok'],
  ['Invoices', 'POST', '/invoices/{{invoiceId}}/payments', 'tenantBearerJson', 'recordPayment', 'ok'],
  ['Invoices', 'PUT', '/invoices/mark-overdue/run', 'tenantBearer', null, 'ok'],

  ['Employees', 'POST', '/employees', 'tenantBearerJson', 'createEmployee', 'employee'],
  ['Employees', 'GET', '/employees?page=1&limit=20', 'tenantBearer', null, 'listMeta'],
  ['Employees', 'GET', '/employees/payroll-export?from=2026-04-01&to=2026-04-30', 'tenantBearer', null, 'ok'],
  ['Employees', 'GET', '/employees/{{employeeId}}', 'tenantBearer', null, 'employee'],
  ['Employees', 'PUT', '/employees/{{employeeId}}', 'tenantBearerJson', 'updateEmployee', 'employee'],
  ['Employees', 'PUT', '/employees/{{employeeId}}/status', 'tenantBearerJson', 'employeeStatus', 'employee'],
  ['Employees', 'DELETE', '/employees/{{employeeId}}', 'tenantBearer', null, 'ok'],

  ['Financials', 'GET', '/financials/summary?projectId={{projectId}}', 'tenantBearer', null, 'ok'],
  ['Financials', 'GET', '/financials/dashboard', 'tenantBearer', null, 'ok'],
  ['Financials', 'GET', '/financials/budget-categories', 'tenantBearer', null, 'listMeta'],
  ['Financials', 'POST', '/financials/budget-categories', 'tenantBearerJson', 'createBudgetCategory', 'ok'],
  ['Financials', 'GET', '/financials/projects/{{projectId}}/budget', 'tenantBearer', null, 'ok'],
  ['Financials', 'PUT', '/financials/projects/{{projectId}}/budget', 'tenantBearerJson', 'setProjectBudget', 'ok'],
  ['Financials', 'GET', '/financials/projects/{{projectId}}/transactions?page=1&limit=20', 'tenantBearer', null, 'listMeta'],
  ['Financials', 'POST', '/financials/transactions', 'tenantBearerJson', 'createTransaction', 'ok'],

  ['Time Tracking', 'GET', '/time-tracking?page=1&limit=20', 'tenantBearer', null, 'listMeta'],
  ['Time Tracking', 'GET', '/time-tracking/active', 'tenantBearer', null, 'ok'],
  ['Time Tracking', 'GET', '/time-tracking/weekly-summary?weekStart=2026-03-30', 'tenantBearer', null, 'ok'],
  ['Time Tracking', 'POST', '/time-tracking/clock-in', 'tenantBearerJson', 'clockIn', 'ok'],
  ['Time Tracking', 'PUT', '/time-tracking/cm9v0time0001abc/clock-out', 'tenantBearerJson', 'clockOut', 'ok'],
  ['Time Tracking', 'POST', '/time-tracking/manual', 'tenantBearerJson', 'manualTimeEntry', 'ok'],
  ['Time Tracking', 'PUT', '/time-tracking/cm9v0time0001abc/approve', 'tenantBearerJson', 'approveTimeEntry', 'ok'],

  ['CRM', 'POST', '/crm/clients', 'tenantBearerJson', 'createClient', 'ok'],
  ['CRM', 'GET', '/crm/clients?page=1&limit=20&search=', 'tenantBearer', null, 'listMeta'],
  ['CRM', 'GET', '/crm/clients/{{clientId}}', 'tenantBearer', null, 'ok'],
  ['CRM', 'PUT', '/crm/clients/{{clientId}}', 'tenantBearerJson', 'updateClient', 'ok'],
  ['CRM', 'DELETE', '/crm/clients/{{clientId}}', 'tenantBearer', null, 'ok'],

  ['Messaging', 'GET', '/messaging/conversations', 'tenantBearer', null, 'listMeta'],
  ['Messaging', 'POST', '/messaging/conversations', 'tenantBearerJson', 'createConversation', 'ok'],
  ['Messaging', 'GET', '/messaging/projects/{{projectId}}/conversation', 'tenantBearer', null, 'ok'],
  ['Messaging', 'GET', '/messaging/conversations/{{conversationId}}/messages?page=1&limit=20', 'tenantBearer', null, 'listMeta'],
  ['Messaging', 'POST', '/messaging/messages', 'tenantBearerJson', 'sendMessage', 'message'],
  ['Messaging', 'PUT', '/messaging/conversations/{{conversationId}}/read', 'tenantBearer', null, 'ok'],

  ['Notifications', 'GET', '/notifications/me?page=1&limit=20', 'tenantBearer', null, 'listMeta'],
  ['Notifications', 'PATCH', '/notifications/cm9v0notif0001abc/read', 'tenantBearerJson', 'markNotificationRead', 'ok'],

  ['Subscriptions', 'GET', '/subscriptions/plans', 'tenantBearer', null, 'listMeta'],
  ['Subscriptions', 'GET', '/subscriptions/current', 'tenantBearer', null, 'ok'],
  ['Subscriptions', 'POST', '/subscriptions/change-plan', 'tenantBearerJson', 'changePlan', 'ok'],

  ['Billing', 'POST', '/billing/paynow/initiate', 'tenantBearerJson', 'paynowInitiate', 'ok'],
  ['Billing', 'POST', '/billing/webhooks/paynow', 'publicJson', { reference: 'paynow_ref_12345', companyId: 'cm9v0co0001abc' }, 'ok'],

  ['Reporting', 'GET', '/reporting', 'tenantBearer', null, 'listMeta'],
  ['Reporting', 'GET', '/reporting/project-progress/{{projectId}}', 'tenantBearer', null, 'ok'],
  ['Reporting', 'GET', '/reporting/labour?from=2026-04-01&to=2026-04-30&projectId={{projectId}}', 'tenantBearer', null, 'ok'],
  ['Reporting', 'GET', '/reporting/materials?projectId={{projectId}}&from=2026-04-01&to=2026-04-30', 'tenantBearer', null, 'ok'],
  ['Reporting', 'GET', '/reporting/financial-summary?from=2026-04-01&to=2026-04-30', 'tenantBearer', null, 'ok'],
  ['Reporting', 'POST', '/reporting/generate', 'tenantBearerJson', 'generateReport', 'ok'],

  ['Onboarding', 'GET', '/onboarding/plans', 'public', null, 'listMeta'],
  ['Onboarding', 'POST', '/onboarding/register', 'publicJson', 'onboardingRegister', 'authTokens'],
  ['Onboarding', 'GET', '/onboarding/subscription-status', 'tenantBearer', null, 'ok'],
  ['Onboarding', 'POST', '/onboarding/activate-subscription', 'tenantBearerJson', 'activateSubscription', 'ok'],

  ['RBAC', 'GET', '/rbac/permissions', 'tenantBearer', null, 'listMeta'],
  ['RBAC', 'GET', '/rbac/roles', 'tenantBearer', null, 'listMeta'],
  ['RBAC', 'GET', '/rbac/roles/cm9v0role0001abc', 'tenantBearer', null, 'ok'],
  ['RBAC', 'POST', '/rbac/roles', 'tenantBearerJson', 'createRole', 'ok'],
  ['RBAC', 'PUT', '/rbac/roles/cm9v0role0001abc', 'tenantBearerJson', 'updateRole', 'ok'],
  ['RBAC', 'DELETE', '/rbac/roles/cm9v0role0001abc', 'tenantBearer', null, 'ok'],
  ['RBAC', 'POST', '/rbac/roles/cm9v0role0001abc/permissions', 'tenantBearerJson', 'assignPermissions', 'ok'],
  ['RBAC', 'DELETE', '/rbac/roles/cm9v0role0001abc/permissions/projects.view', 'tenantBearer', null, 'ok'],
  ['RBAC', 'GET', '/rbac/users/{{userId}}/roles', 'tenantBearer', null, 'listMeta'],
  ['RBAC', 'POST', '/rbac/users/{{userId}}/roles', 'tenantBearerJson', 'assignRoleToUser', 'ok'],
  ['RBAC', 'DELETE', '/rbac/users/{{userId}}/roles/cm9v0role0001abc', 'tenantBearer', null, 'ok'],

  ['Platform Admin Auth', 'POST', '/platform-admin/auth/login', 'publicJson', 'platformLogin', 'platformAuthTokens'],
  ['Platform Admin Auth', 'GET', '/platform-admin/auth/me', 'platformBearer', null, 'ok'],
  ['Platform Admin Auth', 'POST', '/platform-admin/auth/rotate-api-key', 'platformBearer', 'rotateApiKey', 'ok'],

  ['Platform Admin', 'GET', '/platform-admin/overview', 'platformKey', null, 'overview'],
  ['Platform Admin', 'GET', '/platform-admin/companies?page=1&limit=20&search=', 'platformKey', null, 'listMeta'],
  ['Platform Admin', 'GET', '/platform-admin/companies/pending-approvals?page=1&limit=20', 'platformKey', null, 'listMeta'],
  ['Platform Admin', 'PATCH', '/platform-admin/companies/cm9v0co0001abc/approval', 'platformKey', 'updateCompanyApproval', 'company'],
  ['Platform Admin', 'GET', '/platform-admin/subscriptions?page=1&limit=20&search=', 'platformKey', null, 'listMeta'],
  ['Platform Admin', 'PATCH', '/platform-admin/subscriptions/cm9v0sub0001abc/status', 'platformKey', 'updateSubscriptionStatus', 'ok'],
  ['Platform Admin', 'GET', '/platform-admin/billing/payments?page=1&limit=20&search=', 'platformKey', null, 'listMeta'],
];

const folderMap = new Map();
for (const [folder] of endpoints) {
  if (!folderMap.has(folder)) {
    folderMap.set(folder, []);
  }
}

for (const [folder, method, endpoint, authKey, bodyKey, responseKey] of endpoints) {
  const req = {
    name: `${method} ${endpoint}`,
    request: {
      method,
      header: headers[authKey] || [],
      url: {
        raw: `{{baseUrl}}${endpoint}`,
      },
    },
    response: [
      {
        name: 'Sample Success Response',
        originalRequest: {},
        status: 'OK',
        code: method === 'POST' ? 201 : 200,
        _postman_previewlanguage: 'json',
        header: [{ key: 'Content-Type', value: 'application/json' }],
        body: JSON.stringify(responseTemplates[responseKey] || responseTemplates.ok, null, 2),
      },
    ],
  };

  if (method !== 'GET' && method !== 'DELETE') {
    const body = typeof bodyKey === 'string' ? bodyTemplates[bodyKey] : bodyKey;
    req.request.body = {
      mode: 'raw',
      raw: JSON.stringify(body || {}, null, 2),
    };
  }

  folderMap.get(folder).push(req);
}

for (const [folder, items] of folderMap.entries()) {
  baseInfo.item.push({ name: folder, item: items });
}

const outDir = path.join(process.cwd(), 'docs', 'postman');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'builderpro-full.postman_collection.json'),
  JSON.stringify(baseInfo, null, 2),
  'utf8',
);

console.log('Generated docs/postman/builderpro-full.postman_collection.json');
