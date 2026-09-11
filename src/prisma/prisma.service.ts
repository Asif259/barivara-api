import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly nodeEnv: string;

  constructor(configService: ConfigService) {
    // Constructor parameters are in scope before super() — 'this' is not.
    const nodeEnv = configService.get<string>('nodeEnv') ?? 'development';

    super({
      log: nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
    });

    this.nodeEnv = nodeEnv;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to PostgreSQL via Prisma');
    } catch (error) {
      if (this.nodeEnv === 'test') {
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
