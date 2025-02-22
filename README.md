# Image Processor Service

A high-performance image processing service built with NestJS that processes images in parallel using worker threads. The service accepts CSV files containing image URLs, processes the images with compression and resizing, and provides status updates through a RESTful API.

## Features

- Parallel image processing using Worker Threads
- CSV file processing with batch image handling
- Automatic image compression and resizing
- Real-time status tracking
- Webhook notifications for process completion
- RESTful API endpoints
- PostgreSQL database for persistent storage
- Detailed logging and monitoring

## Architecture

### System Components

```mermaid
graph TD
    A[Client] --> B[CSV Controller]
    B --> C[CSV Processor Service]
    C --> D[Worker Pool Service]
    D --> E[Worker Threads]
    E --> F[Sharp Image Processing]
    C --> G[PostgreSQL Database]
    C --> H[Webhook Notifications]
    E --> I[File System Storage]
```

### Component Roles

1. **CSV Controller (`CsvController`)**
   - Handles HTTP requests
   - Manages file uploads
   - Provides status endpoints
   - Handles image downloads

2. **CSV Processor Service (`CsvProcessorService`)**
   - Parses CSV files
   - Manages processing requests
   - Coordinates with worker pool
   - Handles database operations
   - Sends webhook notifications

3. **Worker Pool Service (`WorkerPoolService`)**
   - Manages worker thread pool
   - Distributes processing tasks
   - Handles worker lifecycle
   - Manages task queue
   - Provides load balancing

4. **Worker Threads (`image-processor.worker`)**
   - Downloads images
   - Processes images using Sharp
   - Handles compression and resizing
   - Reports progress back to main thread

## Database Schema

### Processing Requests Table
```sql
CREATE TABLE processing_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name VARCHAR(255),
    status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'),
    webhook_url VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Images Table
```sql
CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    serial_number INTEGER NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    input_url VARCHAR(255) NOT NULL,
    output_url VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    processing_request_id UUID NOT NULL REFERENCES processing_requests(id),
    input_size BIGINT,
    output_size BIGINT,
    compression_ratio FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Upload CSV
```http
POST /csv/upload
Content-Type: multipart/form-data

file: <csv_file>
webhookUrl: <optional_webhook_url>
```

### Check Status
```http
GET /csv/status/:requestId
```

### Download Processed Image
```http
GET /csv/download/:imageId
```

## Processing Flow

1. **CSV Upload**
   - File validation
   - Request creation
   - Background processing initiation

2. **Image Processing**
   - CSV parsing
   - Task distribution to worker pool
   - Parallel image processing
   - Progress tracking
   - Status updates

3. **Worker Thread Processing**
   - Image download
   - Sharp processing
   - Compression (target: 50% reduction)
   - Size validation
   - Result storage

4. **Status Updates**
   - Real-time status tracking
   - Progress monitoring
   - Webhook notifications
   - Error handling

## Technical Specifications

### Image Processing Parameters
- Max dimensions: 800x800 pixels
- Format: JPEG
- Quality: 30
- Chroma subsampling: 4:2:0
- MozJPEG optimization: enabled

### Worker Pool Configuration
- Dynamic worker count based on CPU cores
- Automatic worker replacement on failure
- Task queue management
- Load balancing

### Performance Considerations
- Parallel processing
- Connection pooling
- Efficient file handling
- Memory management
- Error recovery

## Setup and Configuration

### Prerequisites
- Node.js 18+
- PostgreSQL 13+
- Sharp library dependencies

### Environment Variables
```env
PORT=3000
BASE_URL=http://localhost:3000
DATABASE_URL=postgres://user:password@localhost:5432/dbname
```

### Installation
```bash
# Install dependencies
npm install

# Run database migrations
npm run migrate

# Start the service
npm run start
```

## CSV Format
```csv
S. No.,Product Name,Input Image Urls
1,Product1,https://example.com/image1.jpg
2,Product2,https://example.com/image2.jpg
```

## Error Handling

- File validation errors
- Image processing failures
- Worker thread crashes
- Database connection issues
- Webhook delivery failures

## Monitoring and Logging

- Worker pool status
- Processing progress
- Image compression metrics
- Error tracking
- Performance metrics

## Security Considerations

- Input validation
- File type checking
- URL validation
- Error message sanitization
- Resource limits

## Future Improvements

- Additional image formats support
- Custom processing parameters
- Retry mechanisms
- Caching layer
- Metrics dashboard
- Auto-scaling worker pool

## Contributing

Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE.md file for details.
