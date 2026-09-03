import { Module } from '@nestjs/common';
import { RentalAgreementsService } from './rental-agreements.service';
import { RentalAgreementsController } from './rental-agreements.controller';

@Module({
  controllers: [RentalAgreementsController],
  providers: [RentalAgreementsService],
  exports: [RentalAgreementsService],
})
export class RentalAgreementsModule {}
