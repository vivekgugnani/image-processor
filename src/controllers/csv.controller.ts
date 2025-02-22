import { Controller, Post, Get, Param, UseInterceptors, UploadedFile, Query, BadRequestException, NotFoundException, Logger, ParseUUIDPipe, Res, StreamableFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CsvProcessorService } from '../services/csv-processor.service';
import { ProcessingStatusResponse } from '../types/processing.types';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiConsumes, ApiProduces, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CsvUploadDto } from '../dto/csv-upload.dto';
import { ProcessingRequestDto, ImageProcessingDto } from '../dto/processing-response.dto';

@ApiTags('CSV Processing')
@Controller('csv')
export class CsvController {
  private readonly logger = new Logger(CsvController.name);

  constructor(private readonly csvProcessorService: CsvProcessorService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload CSV file for image processing',
    description: 'Upload a CSV file containing image URLs to be processed. The CSV should have columns: S. No., Product Name, Input Image Urls',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'CSV file accepted for processing',
    type: ProcessingRequestDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file format or missing required fields',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/csv',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, `${uniqueSuffix}-${file.originalname}`);
        }
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(csv)$/)) {
          return cb(new BadRequestException('Only CSV files are allowed'), false);
        }
        if (file.mimetype !== 'text/csv' && file.mimetype !== 'application/vnd.ms-excel') {
          return cb(new BadRequestException('Invalid file type. Only CSV files are allowed'), false);
        }
        cb(null, true);
      }
    })
  )
  async uploadCsv(
    @UploadedFile() file: Express.Multer.File,
    @Query('webhookUrl') webhookUrl?: string,
  ): Promise<ProcessingRequestDto> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    this.logger.log(`Received CSV file: ${file.originalname}`);

    try {
      // Read the file content with UTF-8 encoding
      const fileContent = fs.readFileSync(file.path);
      
      // Pass the file buffer directly to the service
      return this.csvProcessorService.processCSV(fileContent, webhookUrl);
    } catch (error) {
      this.logger.error('Error processing CSV:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to process CSV file: ' + error.message);
    } finally {
      // Clean up the uploaded file
      try {
        fs.unlinkSync(file.path);
      } catch (error) {
        this.logger.error('Error cleaning up CSV file:', error);
      }
    }
  }

  @Get('status/:requestId')
  @ApiOperation({
    summary: 'Get processing request status',
    description: 'Retrieve the current status of a CSV processing request and its associated images',
  })
  @ApiParam({
    name: 'requestId',
    description: 'UUID of the processing request',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Processing request details retrieved successfully',
    type: ProcessingRequestDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Processing request not found',
  })
  async getStatus(@Param('requestId', ParseUUIDPipe) requestId: string): Promise<ProcessingRequestDto> {
    try {
      return this.csvProcessorService.getStatus(requestId);
    } catch (error) {
      this.logger.error('Error getting status:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to get processing status: ' + error.message);
    }
  }

  @Get('download/:imageId')
  @ApiOperation({
    summary: 'Download processed image',
    description: 'Download a processed image by its ID',
  })
  @ApiParam({
    name: 'imageId',
    description: 'UUID of the processed image',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiProduces('image/jpeg')
  @ApiResponse({
    status: 200,
    description: 'Image file stream',
  })
  @ApiResponse({
    status: 404,
    description: 'Image not found or not yet processed',
  })
  async downloadImage(
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const imageStream = await this.csvProcessorService.getProcessedImage(imageId);
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="processed-${imageId}.jpg"`,
      });
      imageStream.pipe(res);
    } catch (error) {
      this.logger.error(`Error downloading image ${imageId}:`, error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to download image: ' + error.message);
    }
  }
} 