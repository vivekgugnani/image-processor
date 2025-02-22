import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { CsvController } from '../controllers/csv.controller';
import { CsvProcessorService } from '../services/csv-processor.service';
import { ProcessingRequest } from '../models/processing-request.model';
import { Image } from '../models/image.model';
import { MulterModule } from '@nestjs/platform-express';
import { WorkerPoolService } from '../services/worker-pool.service';

@Module({
  imports: [
    SequelizeModule.forFeature([ProcessingRequest, Image]),
    MulterModule.register({
      dest: './uploads',
    }),
  ],
  controllers: [CsvController],
  providers: [CsvProcessorService, WorkerPoolService],
})
export class CsvModule {} 