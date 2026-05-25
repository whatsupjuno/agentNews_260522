import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EchoBotService } from './echo-bot.service';
import { DemoAccountService } from './demo-account.service';
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
  providers: [EchoBotService, DemoAccountService],
  exports: [EchoBotService],
})
export class DemoModule {}
