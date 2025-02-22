import { Injectable, Logger } from '@nestjs/common';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';

interface WorkerData {
  inputUrl: string;
  imageId: string;
  outputDir: string;
}

interface ProcessResult {
  id: string;
  inputSize: number;
  outputSize: number;
  compressionRatio: number;
}

@Injectable()
export class WorkerPoolService {
  private workers: Worker[] = [];
  private taskQueue: { 
    data: WorkerData; 
    resolve: (value: ProcessResult) => void;
    reject: (reason: any) => void;
  }[] = [];
  private availableWorkers: Worker[] = [];
  private readonly logger = new Logger(WorkerPoolService.name);
  private readonly numWorkers: number;
  private workerIds: Map<Worker, number> = new Map();
  private activeJobs: Map<Worker, string> = new Map();
  private readonly MAX_WORKERS = 15;

  constructor() {
    // Calculate number of workers, minimum 1, maximum 5
    const cpuCount = Math.max(1, os.cpus().length - 1);
    this.numWorkers = Math.min(cpuCount, this.MAX_WORKERS);
    this.logger.log(`Initializing worker pool with ${this.numWorkers} workers (max: ${this.MAX_WORKERS})`);
    this.initializeWorkers();
  }

  private initializeWorkers() {
    const workerPath = path.join(process.cwd(), 'dist', 'workers', 'image-processor.worker.js');
    
    for (let i = 0; i < this.numWorkers; i++) {
      const worker = new Worker(workerPath);
      this.workerIds.set(worker, i + 1);
      
      worker.on('message', (message) => {
        const workerId = this.workerIds.get(worker);
        const imageId = this.activeJobs.get(worker);
        this.logger.log(`Worker ${workerId} completed processing image ${imageId}`);
        this.activeJobs.delete(worker);
        this.handleWorkerMessage(worker, message);
      });

      worker.on('error', (error) => {
        const workerId = this.workerIds.get(worker);
        const imageId = this.activeJobs.get(worker);
        this.logger.error(`Worker ${workerId} encountered error while processing image ${imageId}: ${error.message}`);
        this.handleWorkerError(worker, error);
      });

      worker.on('exit', (code) => {
        const workerId = this.workerIds.get(worker);
        if (code !== 0) {
          this.logger.error(`Worker ${workerId} stopped with exit code ${code}`);
        }
        this.replaceWorker(worker);
      });

      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }

    this.logger.log(`Initialized ${this.numWorkers} workers`);
    this.logPoolStatus();
  }

  private logPoolStatus() {
    const available = this.availableWorkers.length;
    const busy = this.workers.length - available;
    const queued = this.taskQueue.length;
    this.logger.log(`Worker pool status - Total: ${this.workers.length}, Available: ${available}, Busy: ${busy}, Queued tasks: ${queued}`);
  }

  private handleWorkerMessage(worker: Worker, message: { success: boolean; result?: ProcessResult; error?: string }) {
    const workerId = this.workerIds.get(worker);
    const imageId = this.activeJobs.get(worker);
    
    if (message.success) {
      this.logger.log(`Worker ${workerId} completed processing image ${imageId}`);
      // Get and resolve the task's promise
      const task = this.taskQueue.shift();
      if (task) {
        task.resolve(message.result!);
      }
    } else {
      this.logger.error(`Worker ${workerId} failed to process image ${imageId}: ${message.error}`);
      const task = this.taskQueue.shift();
      if (task) {
        task.reject(new Error(message.error));
      }
    }

    // Clear the active job and make worker available
    this.activeJobs.delete(worker);
    this.availableWorkers.push(worker);
    this.logger.log(`Worker ${workerId} is now idle`);
    this.logPoolStatus();

    // Process next task if available
    this.processNextTask();
  }

  private handleWorkerError(worker: Worker, error: Error) {
    const workerId = this.workerIds.get(worker);
    const task = this.taskQueue.shift();
    if (task) {
      this.logger.error(`Worker ${workerId} failed to process image ${task.data.imageId}: ${error.message}`);
      task.reject(error);
    }
    this.replaceWorker(worker);
  }

  private replaceWorker(worker: Worker) {
    const oldWorkerId = this.workerIds.get(worker);
    const index = this.workers.indexOf(worker);
    if (index > -1) {
      this.workers.splice(index, 1);
      this.availableWorkers = this.availableWorkers.filter(w => w !== worker);
      this.workerIds.delete(worker);
      this.activeJobs.delete(worker);
      
      const workerPath = path.join(process.cwd(), 'dist', 'workers', 'image-processor.worker.js');
      const newWorker = new Worker(workerPath);
      this.workerIds.set(newWorker, oldWorkerId!);
      
      this.logger.log(`Replacing worker ${oldWorkerId} with new instance`);

      newWorker.on('message', (message) => {
        this.handleWorkerMessage(newWorker, message);
      });

      newWorker.on('error', (error) => {
        this.handleWorkerError(newWorker, error);
      });

      this.workers.push(newWorker);
      this.availableWorkers.push(newWorker);
      this.logPoolStatus();
    }
  }

  private processNextTask() {
    if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
      return;
    }

    const worker = this.availableWorkers.pop()!;
    const task = this.taskQueue[0]; // Don't shift yet, will be shifted after completion
    const workerId = this.workerIds.get(worker);
    
    if (task) {
      this.logger.log(`Worker ${workerId} starting to process image ${task.data.imageId}`);
      this.activeJobs.set(worker, task.data.imageId);
      worker.postMessage(task.data);
    } else {
      this.availableWorkers.push(worker);
    }
    this.logPoolStatus();
  }

  async processImage(data: WorkerData): Promise<ProcessResult> {
    this.logger.log(`Received request to process image ${data.imageId}`);
    this.logPoolStatus();

    return new Promise((resolve, reject) => {
      const task = { data, resolve, reject };
      this.taskQueue.push(task);

      if (this.availableWorkers.length > 0) {
        this.processNextTask();
      } else {
        this.logger.log(`No available workers, queuing image ${data.imageId}`);
      }
    });
  }

  async cleanup() {
    this.logger.log('Cleaning up worker pool');
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.workerIds.clear();
    this.activeJobs.clear();
    this.logger.log('Worker pool cleanup completed');
  }
} 