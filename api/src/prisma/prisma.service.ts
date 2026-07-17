import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Local dev sets DATABASE_URL directly (.env, plain docker-compose Postgres, no TLS).
// In ECS, the DB credentials arrive as separate Secrets Manager fields
// (DB_HOST/DB_PORT/DB_NAME/DB_USERNAME/DB_PASSWORD) because the RDS secret has no
// single connection-string field — and RDS enforces TLS on that path, which
// node-postgres does not negotiate on its own the way Prisma's migration engine does.
function resolveDatabaseConfig(): { connectionString: string; ssl?: { rejectUnauthorized: boolean } } {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  const { DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, DB_PASSWORD } = process.env;
  if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USERNAME || !DB_PASSWORD) {
    throw new Error(
      'No DATABASE_URL and incomplete DB_HOST/DB_PORT/DB_NAME/DB_USERNAME/DB_PASSWORD to build one from',
    );
  }
  const encodedPassword = encodeURIComponent(DB_PASSWORD);
  return {
    connectionString: `postgresql://${DB_USERNAME}:${encodedPassword}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public`,
    // TODO(Phase 4 hardening): pin the AWS RDS CA bundle and set rejectUnauthorized: true
    // instead of trusting any cert — acceptable for now since this connection never
    // leaves the private, isolated VPC subnet.
    ssl: { rejectUnauthorized: false },
  };
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg(resolveDatabaseConfig()) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
