import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth.module';
import { SequenceService } from './application/use-cases/sequence.service';
import { SequenceController } from './presentation/controllers/sequence.controller';
import {
  AgentSecretSequenceEntity,
  UnlockSessionEntity,
} from './infrastructure/database/entities';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([AgentSecretSequenceEntity, UnlockSessionEntity]),
  ],
  controllers: [SequenceController],
  providers: [SequenceService],
  exports: [SequenceService],
})
export class SequenceModule {}
