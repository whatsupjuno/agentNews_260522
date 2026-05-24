import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EchoBotService } from './echo-bot.service';
import {
  AgentEntity,
  AgentSecretSequenceEntity,
  MessageEntity,
  PairingEntity,
} from '../database/entities';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AgentEntity,
      AgentSecretSequenceEntity,
      PairingEntity,
      MessageEntity,
    ]),
  ],
  providers: [EchoBotService],
  exports: [EchoBotService],
})
export class DemoModule {}
