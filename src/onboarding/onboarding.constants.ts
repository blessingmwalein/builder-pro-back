export const CONSTRUCTION_SECTORS = [
  { code: 'RESIDENTIAL', name: 'Residential' },
  { code: 'COMMERCIAL', name: 'Commercial' },
  { code: 'INDUSTRIAL', name: 'Industrial' },
  { code: 'INFRASTRUCTURE', name: 'Infrastructure' },
  { code: 'BANKS', name: 'Banks' },
  { code: 'SCHOOLS', name: 'Schools' },
  { code: 'FACTORIES', name: 'Factories' },
  { code: 'ROADS', name: 'Roads' },
  { code: 'RENOVATIONS', name: 'Renovations' },
  { code: 'ROOFING', name: 'Roofing' },
  { code: 'EXTENSIONS', name: 'Extensions' },
  { code: 'MAINTENANCE', name: 'Maintenance' },
];

export const CONSTRUCTION_PROJECT_TYPES = [
  { code: 'HOUSE_CONSTRUCTION', name: 'House Construction' },
  { code: 'BANK_CONSTRUCTION', name: 'Bank Construction' },
  { code: 'OFFICE_CONSTRUCTION', name: 'Office Construction' },
  { code: 'RENOVATION', name: 'Renovation' },
  { code: 'FLOOR_CHANGES', name: 'Floor Changes' },
  { code: 'ROOFING', name: 'Roofing' },
  { code: 'MAINTENANCE', name: 'Maintenance' },
  { code: 'PAINTING', name: 'Painting' },
  { code: 'EXTENSIONS', name: 'Extensions' },
];

export const STAKEHOLDER_TYPES: Record<string, { name: string; description: string; permissions: string[] }> = {
  CLIENT: {
    name: 'Client',
    description: 'Project owner / paying customer',
    permissions: ['projects.view', 'quotes.view', 'invoices.view'],
  },
  PROJECT_MANAGER: {
    name: 'Project Manager',
    description: 'Oversees day-to-day project delivery',
    permissions: [
      'projects.*', 'tasks.*', 'timesheets.*', 'materials.*', 'quotes.*',
      'invoices.*', 'financials.*', 'employees.*', 'crm.*', 'reports.*',
      'messaging.*', 'documents.*',
    ],
  },
  ARCHITECT: {
    name: 'Architect',
    description: 'Designs structures and reviews drawings',
    permissions: ['projects.view', 'projects.update', 'documents.*', 'tasks.view', 'quotes.view', 'messaging.*'],
  },
  ENGINEER: {
    name: 'Engineer',
    description: 'Structural, civil or MEP engineer',
    permissions: ['projects.*', 'tasks.*', 'materials.*', 'documents.*', 'reports.*', 'messaging.*'],
  },
  QUANTITY_SURVEYOR: {
    name: 'Quantity Surveyor',
    description: 'Manages costs, bills of quantities and valuations',
    permissions: ['quotes.*', 'financials.*', 'materials.*', 'reports.*'],
  },
  FOREMAN: {
    name: 'Foreman',
    description: 'On-site supervisor who manages workers',
    permissions: ['projects.view', 'tasks.*', 'timesheets.*', 'materials.*', 'messaging.*', 'documents.*'],
  },
  SUPPLIER: {
    name: 'Supplier',
    description: 'Provides materials and equipment',
    permissions: ['materials.view', 'quotes.view'],
  },
  INSPECTOR: {
    name: 'Inspector',
    description: 'Quality control and compliance inspector',
    permissions: ['projects.view', 'documents.*', 'tasks.view', 'reports.view'],
  },
  PROCUREMENT: {
    name: 'Procurement Officer',
    description: 'Sources materials and manages purchasing',
    permissions: ['materials.*', 'quotes.*', 'financials.view', 'documents.*'],
  },
  FINANCE: {
    name: 'Finance Officer',
    description: 'Handles invoicing, payments and financial reporting',
    permissions: ['invoices.*', 'financials.*', 'quotes.view', 'reports.*'],
  },
  SAFETY_OFFICER: {
    name: 'Safety Officer',
    description: 'Enforces health and safety on site',
    permissions: ['projects.view', 'tasks.view', 'documents.*', 'messaging.*'],
  },
  MAINTENANCE_TEAM: {
    name: 'Maintenance Team',
    description: 'Carries out ongoing site maintenance',
    permissions: ['projects.view', 'tasks.*', 'materials.*', 'messaging.*'],
  },
};

export const WORKFLOW_TEMPLATES: Record<string, { name: string; description: string; stages: object[] }> = {
  PROJECT_INITIATION: {
    name: 'Project Initiation',
    description: 'Kickoff from brief to approval',
    stages: [
      { name: 'Brief', order: 1 },
      { name: 'Feasibility', order: 2 },
      { name: 'Approval', order: 3, requiresApproval: true },
    ],
  },
  PLANNING: {
    name: 'Planning',
    description: 'Project planning and design review',
    stages: [
      { name: 'Planning', order: 1 },
      { name: 'Design Review', order: 2, requiresApproval: true },
    ],
  },
  DESIGN: {
    name: 'Design',
    description: 'Concept through to design sign-off',
    stages: [
      { name: 'Concept', order: 1 },
      { name: 'Detail Design', order: 2 },
      { name: 'Sign-off', order: 3, requiresApproval: true },
    ],
  },
  BUDGETING: {
    name: 'Budgeting',
    description: 'Estimate, quote and budget approval',
    stages: [
      { name: 'Estimate', order: 1 },
      { name: 'Quote', order: 2 },
      { name: 'Approval', order: 3, requiresApproval: true },
    ],
  },
  PROCUREMENT: {
    name: 'Procurement',
    description: 'Material request through to delivery',
    stages: [
      { name: 'Request', order: 1 },
      { name: 'Order', order: 2 },
      { name: 'Receive', order: 3 },
    ],
  },
  EXECUTION: {
    name: 'Execution',
    description: 'Mobilise, build and progress review',
    stages: [
      { name: 'Mobilise', order: 1 },
      { name: 'Build', order: 2 },
      { name: 'Progress Review', order: 3 },
    ],
  },
  INSPECTION: {
    name: 'Inspection',
    description: 'Snagging, inspection and sign-off',
    stages: [
      { name: 'Snagging', order: 1 },
      { name: 'Inspection', order: 2 },
      { name: 'Sign-off', order: 3, requiresApproval: true },
    ],
  },
  HANDOVER: {
    name: 'Handover',
    description: 'Handover pack through to final sign-off',
    stages: [
      { name: 'Handover Pack', order: 1 },
      { name: 'Defects Period', order: 2 },
      { name: 'Final Sign-off', order: 3, requiresApproval: true },
    ],
  },
  MAINTENANCE: {
    name: 'Maintenance',
    description: 'Schedule, execute and report maintenance',
    stages: [
      { name: 'Schedule', order: 1 },
      { name: 'Execute', order: 2 },
      { name: 'Report', order: 3 },
    ],
  },
  FEASIBILITY: {
    name: 'Feasibility',
    description: 'Feasibility study and sign-off',
    stages: [
      { name: 'Study', order: 1 },
      { name: 'Report', order: 2 },
      { name: 'Sign-off', order: 3, requiresApproval: true },
    ],
  },
  PERMITS: {
    name: 'Permits & Approvals',
    description: 'Municipal and regulatory permit applications',
    stages: [
      { name: 'Application', order: 1 },
      { name: 'Review', order: 2 },
      { name: 'Issue', order: 3, requiresApproval: true },
    ],
  },
  MOBILIZATION: {
    name: 'Mobilization',
    description: 'Site preparation and resource deployment',
    stages: [
      { name: 'Site Setup', order: 1 },
      { name: 'Resource Deployment', order: 2 },
    ],
  },
  MONITORING: {
    name: 'Monitoring',
    description: 'Ongoing progress monitoring and reporting',
    stages: [
      { name: 'Progress Report', order: 1 },
      { name: 'Review Meeting', order: 2 },
    ],
  },
  CHANGE_REQUESTS: {
    name: 'Change Management',
    description: 'Client and internal change request processing',
    stages: [
      { name: 'Request', order: 1 },
      { name: 'Assessment', order: 2 },
      { name: 'Approval', order: 3, requiresApproval: true },
    ],
  },
  PAYMENTS: {
    name: 'Payments',
    description: 'Progress claims and payment certification',
    stages: [
      { name: 'Claim', order: 1 },
      { name: 'Certification', order: 2, requiresApproval: true },
      { name: 'Payment', order: 3 },
    ],
  },
};

export const PROJECT_TYPE_DEFAULT_STAGES: Record<string, string[]> = {
  RESIDENTIAL:    ['PROJECT_INITIATION', 'PLANNING', 'DESIGN', 'BUDGETING', 'PERMITS', 'PROCUREMENT', 'EXECUTION', 'PAYMENTS', 'INSPECTION', 'HANDOVER'],
  COMMERCIAL:     ['PROJECT_INITIATION', 'FEASIBILITY', 'PLANNING', 'DESIGN', 'BUDGETING', 'PERMITS', 'PROCUREMENT', 'MOBILIZATION', 'EXECUTION', 'MONITORING', 'CHANGE_REQUESTS', 'PAYMENTS', 'INSPECTION', 'HANDOVER'],
  RENOVATION:     ['PROJECT_INITIATION', 'PLANNING', 'BUDGETING', 'PROCUREMENT', 'EXECUTION', 'PAYMENTS', 'INSPECTION', 'HANDOVER'],
  INFRASTRUCTURE: ['PROJECT_INITIATION', 'FEASIBILITY', 'PLANNING', 'DESIGN', 'BUDGETING', 'PERMITS', 'PROCUREMENT', 'MOBILIZATION', 'EXECUTION', 'MONITORING', 'PAYMENTS', 'INSPECTION', 'HANDOVER', 'MAINTENANCE'],
  INDUSTRIAL:     ['PROJECT_INITIATION', 'FEASIBILITY', 'PLANNING', 'DESIGN', 'BUDGETING', 'PERMITS', 'PROCUREMENT', 'MOBILIZATION', 'EXECUTION', 'MONITORING', 'PAYMENTS', 'INSPECTION', 'HANDOVER'],
  OTHER:          ['PROJECT_INITIATION', 'PLANNING', 'BUDGETING', 'EXECUTION', 'HANDOVER'],
};

export const DEFAULT_SECTORS = ['RESIDENTIAL', 'COMMERCIAL', 'RENOVATIONS', 'MAINTENANCE'];
export const DEFAULT_PROJECT_TYPES = ['HOUSE_CONSTRUCTION', 'RENOVATION', 'MAINTENANCE'];
export const DEFAULT_STAKEHOLDERS = ['CLIENT', 'PROJECT_MANAGER', 'FOREMAN'];
export const DEFAULT_WORKFLOWS = ['PROJECT_INITIATION', 'PLANNING', 'EXECUTION', 'HANDOVER'];
