import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Local dev sets DATABASE_URL directly (.env). In ECS, the DB credentials arrive
// as separate Secrets Manager fields (DB_HOST/DB_PORT/DB_NAME/DB_USERNAME/DB_PASSWORD)
// because the RDS secret has no single connection-string field to reference.
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const { DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD } = process.env;
  if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USERNAME || !DB_PASSWORD) {
    throw new Error(
      'No DATABASE_URL and incomplete DB_HOST/DB_PORT/DB_NAME/DB_USERNAME/DB_PASSWORD to build one from',
    );
  }
  const encodedPassword = encodeURIComponent(DB_PASSWORD);
  return `postgresql://${DB_USERNAME}:${encodedPassword}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: resolveDatabaseUrl() }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
