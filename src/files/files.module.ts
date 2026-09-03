import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { SupabaseStorageService } from './storage/supabase-storage.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [FilesController],
  providers: [FilesService, SupabaseStorageService],
  exports: [FilesService],
})
export class FilesModule {}
