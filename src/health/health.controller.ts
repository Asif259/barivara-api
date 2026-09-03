import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'সিস্টেম ও ডাটাবেজ হেলথ চেক' })
  @ApiResponse({ status: 200, description: 'সিস্টেম সচল রয়েছে' })
  async check() {
    let dbStatus = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'down';
    }

    return {
      message: 'সার্ভার সচল রয়েছে',
      data: {
        status: dbStatus === 'up' ? 'ok' : 'degraded',
        database: dbStatus,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
