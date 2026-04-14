import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const runDbE2e = process.env.RUN_DB_E2E === 'true';
const describeIfDb = runDbE2e ? describe : describe.skip;

describeIfDb('Auth Workflow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, logs in, and refreshes token', async () => {
    const email = `worker.${Date.now()}@builderpro.local`;
    const password = 'ChangeMe123!';

    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'E2E',
        lastName: 'Worker',
        email,
        password,
        companySlug: process.env.DEFAULT_COMPANY_SLUG ?? 'builder-pro-demo',
      })
      .expect(201);

    expect(register.body.accessToken).toBeDefined();
    expect(register.body.refreshToken).toBeDefined();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('x-tenant-slug', process.env.DEFAULT_COMPANY_SLUG ?? 'builder-pro-demo')
      .send({
        email,
        password,
      })
      .expect(201);

    expect(login.body.accessToken).toBeDefined();
    expect(login.body.refreshToken).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: login.body.refreshToken,
      })
      .expect(201);
  });
});
