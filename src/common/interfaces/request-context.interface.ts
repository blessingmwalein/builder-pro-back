export interface RequestTenant {
  companyId: string;
  slug: string;
}

export interface RequestUser {
  userId: string;
  companyId: string;
  email: string;
  permissions: string[];
}

export interface RequestPlatformAdminUser {
  adminUserId: string;
  email: string;
  displayName: string;
}
