import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth.module';
import { MessageService } from './application/use-cases/message.service';
import { MessageController } from './presentation/controllers/message.controller';
import { MessageGateway } from './presentation/gateways/message.gateway';
import {
  AgentEntity,
  MessageEntity,
  PairingEntity,
  PushTokenEntity,
} from './infrastructure/database/entities';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([MessageEntity, PairingEntity, AgentEntity, PushTokenEntity]),
  ],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway],
  exports: [MessageService],
})
export class MessageModule {}
