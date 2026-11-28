import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatEvents } from './chat-events.service';
import { ChatService } from './chat.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatEvents],
})
export class ChatModule {}
