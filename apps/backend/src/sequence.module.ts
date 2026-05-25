import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth.module';
import { AdminModule } from './admin.module';
import { SequenceService } from './application/use-cases/sequence.service';
import { SequenceController } from './presentation/controllers/sequence.controller';
import { SequenceConfigController } from './presentation/controllers/sequence-config.controller';
import {
  AgentSecretSequenceEntity,
  UnlockSessionEntity,
} from './infrastructure/database/entities';

@Module({
  imports: [
    AuthModule,
    AdminModule, // SequenceConfigService 가져옴
    TypeOrmModule.forFeature([AgentSecretSequenceEntity, UnlockSessionEntity]),
  ],
  controllers: [SequenceController, SequenceConfigController],
  providers: [SequenceService],
  exports: [SequenceService],
})
export class SequenceModule {}
