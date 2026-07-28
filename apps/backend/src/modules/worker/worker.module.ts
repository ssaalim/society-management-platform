import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [
    // EmailWorker // Example worker
  ],
})
export class WorkerModule {}
