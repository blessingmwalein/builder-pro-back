import type {
  RequestPlatformAdminUser,
  RequestTenant,
  RequestUser,
} from '../common/interfaces/request-context.interface';

declare module 'express-serve-static-core' {
  interface Request {
    tenant?: RequestTenant;
    user?: RequestUser;
    platformAdmin?: RequestPlatformAdminUser;
  }
}
