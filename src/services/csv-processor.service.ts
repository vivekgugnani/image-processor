import { Injectable, NotFoundException, Logger, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ProcessingRequest, ProcessingStatus } from '../models/processing-request.model';
import { Image } from '../models/image.model';
import { ProcessingStatusResponse, CsvRecord } from '../types/processing.types';
import { parse } from 'csv-parse/sync';
import axios from 'axios';
import * as sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { ConfigService } from '@nestjs/config';
import { WorkerPoolService } from './worker-pool.service';
import { ProcessingRequestDto, ImageProcessingDto } from '../dto/processing-response.dto';
import { Readable } from 'stream';

@Injectable()
export class CsvProcessorService implements OnModuleDestroy {
  private readonly logger = new Logger(CsvProcessorService.name);
  private readonly baseUrl: string;
  private readonly outputDir: string;

  constructor(
    @InjectModel(ProcessingRequest)
    private processingRequestModel: typeof ProcessingRequest,
    @InjectModel(Image)
    private imageModel: typeof Image,
    private configService: ConfigService,
    private workerPool: WorkerPoolService,
  ) {
    const port = this.configService.get('PORT', 3000);
    this.baseUrl = this.configService.get('BASE_URL', `http://localhost:${port}`);
    this.outputDir = path.join(process.cwd(), 'uploads', 'processed');
  }

  async onModuleDestroy() {
    await this.workerPool.cleanup();
  }

  async processCSV(file: Express.Multer.File | Buffer, webhookUrl?: string): Promise<ProcessingRequestDto> {
    this.logger.log('Starting CSV processing');
    try {
      const records = this.parseCSV(file);
      
      if (!records || records.length === 0) {
        throw new BadRequestException('CSV file is empty or invalid');
      }

      const processingRequest = await this.processingRequestModel.create({
        status: ProcessingStatus.PENDING,
        webhookUrl,
        productName: records[0]?.['Product Name'] || 'Default',
      });

      this.logger.log(`Created processing request with ID: ${processingRequest.id}`);

      // Start processing in the background using Promise
      Promise.resolve().then(async () => {
        this.logger.log(`[${processingRequest.id}] Starting background processing`);
        try {
          const request = await this.processingRequestModel.findByPk(processingRequest.id);
          if (!request) {
            this.logger.error(`[${processingRequest.id}] Request not found for background processing`);
            return;
          }

          await request.update({ status: ProcessingStatus.PROCESSING });
          this.logger.log(`[${processingRequest.id}] Updated initial status to PROCESSING`);

          await this.processRecords(records, processingRequest.id);
          this.logger.log(`[${processingRequest.id}] Background processing completed successfully`);
          
          // Final status update
          const finalRequest = await this.processingRequestModel.findByPk(processingRequest.id);
          if (finalRequest) {
            await finalRequest.update({ status: ProcessingStatus.COMPLETED });
            this.logger.log(`[${processingRequest.id}] Final status updated to COMPLETED`);
          }
        } catch (error) {
          this.logger.error(`[${processingRequest.id}] Background processing failed:`, error);
          const failedRequest = await this.processingRequestModel.findByPk(processingRequest.id);
          if (failedRequest) {
            await failedRequest.update({
              status: ProcessingStatus.FAILED,
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            });
            this.logger.log(`[${processingRequest.id}] Status updated to FAILED`);
          }
        }
      }).catch(error => {
        this.logger.error(`[${processingRequest.id}] Critical error in background processing:`, error);
      });

      const requestDto = {
        id: processingRequest.id,
        productName: processingRequest.productName,
        status: processingRequest.status,
        webhookUrl: processingRequest.webhookUrl,
        errorMessage: processingRequest.errorMessage,
        createdAt: processingRequest.createdAt,
        updatedAt: processingRequest.updatedAt,
      };
      
      return requestDto;
    } catch (error) {
      this.logger.error('Error in processCSV:', error);
      throw error;
    }
  }

  private parseCSV(file: Express.Multer.File | Buffer): CsvRecord[] {
    try {
      let content: string;
      if (Buffer.isBuffer(file)) {
        content = file.toString('utf-8');
      } else if (file instanceof Object && 'buffer' in file) {
        content = file.buffer.toString('utf-8');
      } else {
        throw new BadRequestException('Invalid file format');
      }

      this.logger.debug(`CSV Content: ${content}`); // Debug log to see the content

      const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        skipRecordsWithError: true,
      });

      this.logger.debug(`Parsed Records: ${JSON.stringify(records)}`); // Debug log to see parsed records

      if (!Array.isArray(records) || records.length === 0) {
        throw new BadRequestException('No valid records found in CSV');
      }

      // Validate required columns
      const requiredColumns = ['S. No.', 'Product Name', 'Input Image Urls'];
      const firstRecord = records[0];
      const missingColumns = requiredColumns.filter(col => !(col in firstRecord));

      if (missingColumns.length > 0) {
        throw new BadRequestException(`Missing required columns: ${missingColumns.join(', ')}`);
      }

      return records;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Error parsing CSV:', error);
      throw new BadRequestException(`Failed to parse CSV file: ${error.message}`);
    }
  }

  private async processRecords(records: CsvRecord[], requestId: string) {
    this.logger.log(`[${requestId}] Starting processRecords`);
    try {
      await fs.mkdir(this.outputDir, { recursive: true });

      const processPromises: Promise<void>[] = [];
      let totalImages = 0;
      let completedImages = 0;

      for (const record of records) {
        if (!record['Input Image Urls']) {
          this.logger.warn(`[${requestId}] No Input Image Urls found for record: ${JSON.stringify(record)}`);
          continue;
        }

        const urls = record['Input Image Urls'].split(',').map(url => url.trim()).filter(url => url);
        totalImages += urls.length;
        this.logger.log(`[${requestId}] Processing ${urls.length} images from record, total images: ${totalImages}`);
        
        for (const url of urls) {
          const imageData = {
            serialNumber: record['S. No.'],
            productName: record['Product Name'],
            inputUrl: url,
            outputUrl: '',
            status: 'pending',
            processingRequestId: requestId,
          };

          const processPromise = (async () => {
            try {
              this.logger.log(`[${requestId}] Creating image record for URL: ${url}`);
              const image = await this.imageModel.create(imageData);
              this.logger.log(`[${requestId}] Created image record with ID: ${image.id}`);

              const processedImage = await this.workerPool.processImage({
                inputUrl: url,
                imageId: image.id,
                outputDir: this.outputDir,
              });

              this.logger.log(`[${requestId}] Updating image ${image.id} with processed data`);
              await image.update({
                outputUrl: processedImage.id,
                status: 'completed',
                inputSize: processedImage.inputSize,
                outputSize: processedImage.outputSize,
                compressionRatio: processedImage.compressionRatio,
              });
              this.logger.log(`[${requestId}] Updated image ${image.id} status to completed`);

              completedImages++;
              this.logger.log(`[${requestId}] Progress: ${completedImages}/${totalImages} images processed`);
            } catch (error) {
              this.logger.error(`[${requestId}] Error processing image URL ${url}:`, error);
              await this.imageModel.create({
                ...imageData,
                status: 'failed',
                outputUrl: '',
              });
              this.logger.log(`[${requestId}] Created failed image record for URL: ${url}`);
              completedImages++;
            }
          })();

          processPromises.push(processPromise);
        }
      }

      this.logger.log(`[${requestId}] Waiting for all ${processPromises.length} image processing promises to complete`);
      await Promise.all(processPromises);
      this.logger.log(`[${requestId}] All image processing promises completed`);
    } catch (error) {
      this.logger.error(`[${requestId}] Error in processRecords:`, error);
      throw error;
    }
  }

  private getDownloadUrl(imageId: string): string {
    return `${this.baseUrl}/csv/download/${imageId}`;
  }

  private async processImage(inputUrl: string, imageId: string): Promise<{ id: string; inputSize: number; outputSize: number; compressionRatio: number }> {
    try {
      const response = await axios.get(inputUrl, { 
        responseType: 'arraybuffer',
        timeout: 10000,
      });
      const inputBuffer = Buffer.from(response.data);
      const inputSize = inputBuffer.length;
      this.logger.log(`Downloaded image size: ${(inputSize / 1024).toFixed(2)} KB`);

      const outputDir = path.join(process.cwd(), 'uploads', 'processed');
      await fs.mkdir(outputDir, { recursive: true });

      const outputPath = path.join(outputDir, `${imageId}.jpg`);
      
      await sharp(inputBuffer)
        .jpeg({
          quality: 30,
          chromaSubsampling: '4:2:0',
          force: true,
          mozjpeg: true
        })
        .resize({
          width: 800,
          height: 800,
          fit: 'inside',
          withoutEnlargement: true
        })
        .toFile(outputPath);

      const outputStats = await fs.stat(outputPath);
      const compressionRatio = ((1 - outputStats.size / inputSize) * 100).toFixed(2);
      this.logger.log(`Processed image size: ${(outputStats.size / 1024).toFixed(2)} KB (${compressionRatio}% reduction)`);

      return {
        id: imageId,
        inputSize,
        outputSize: outputStats.size,
        compressionRatio: parseFloat(compressionRatio),
      };
    } catch (error) {
      this.logger.error(`Error processing image from URL ${inputUrl}:`, error);
      throw error;
    }
  }

  async getStatus(requestId: string): Promise<ProcessingRequestDto> {
    try {
      const request = await this.processingRequestModel.findByPk(requestId);

      if (!request) {
        throw new NotFoundException(`Processing request ${requestId} not found`);
      }

      const images = await this.imageModel.findAll({
        where: { processingRequestId: requestId },
        order: [['serialNumber', 'ASC']],
      });

      const processedImages = images.map((img) => ({
        serialNumber: img.serialNumber,
        productName: img.productName,
        inputUrl: img.inputUrl,
        outputUrl: img.outputUrl ? this.getDownloadUrl(img.outputUrl) : '',
        status: img.status,
        sizes: {
          input: img.inputSize || 0,
          output: img.outputSize || 0,
          compressionRatio: img.compressionRatio || 0,
        },
      }));

      const requestDto = {
        id: request.id,
        productName: request.productName,
        status: request.status,
        webhookUrl: request.webhookUrl,
        errorMessage: request.errorMessage,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        images: processedImages,
      };
      
      return requestDto;
    } catch (error) {
      this.logger.error(`Error getting status for request ${requestId}:`, error);
      throw error;
    }
  }

  async getProcessedImage(imageId: string): Promise<Readable> {
    const imagePath = path.join(process.cwd(), 'uploads', 'processed', `${imageId}.jpg`);
    
    if (!fsSync.existsSync(imagePath)) {
      throw new NotFoundException('Image not found or not yet processed');
    }
    
    return fsSync.createReadStream(imagePath);
  }
} 