import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Type for the interactive transaction client (Prisma 7 compatible).
 * Using PrismaClient directly because the Omit<PrismaClient, ITXClientDenyList>
 * extraction from the overloaded $transaction signature drops model delegates in Prisma 7.
 * At runtime, tx IS a PrismaClient instance with $transaction/$connect disabled.
 */
export type PrismaTx = PrismaClient;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to PostgreSQL via Prisma');
    } catch (error) {
      if (process.env.NODE_ENV === 'test') {
        this.logger.warn(`Database connection deferred for test environment: ${error.message}`);
        return;
      }
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
