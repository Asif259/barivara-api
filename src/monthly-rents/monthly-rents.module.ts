import { Module } from '@nestjs/common';
import { MonthlyRentsService } from './monthly-rents.service';
import { MonthlyRentsController } from './monthly-rents.controller';

@Module({
  controllers: [MonthlyRentsController],
  providers: [MonthlyRentsService],
  exports: [MonthlyRentsService],
})
export class MonthlyRentsModule {}
