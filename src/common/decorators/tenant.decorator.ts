import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestTenant } from '../interfaces/request-context.interface';

export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestTenant | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant as RequestTenant | undefined;
  },
);
