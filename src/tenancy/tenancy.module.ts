import {
	MiddlewareConsumer,
	Module,
	NestModule,
	RequestMethod,
} from '@nestjs/common';
import { TenancyMiddleware } from './tenancy.middleware';

@Module({
	providers: [TenancyMiddleware],
})
export class TenancyModule implements NestModule {
	configure(consumer: MiddlewareConsumer): void {
		consumer.apply(TenancyMiddleware).forRoutes({
			path: '*path',
			method: RequestMethod.ALL,
		});
	}
}
