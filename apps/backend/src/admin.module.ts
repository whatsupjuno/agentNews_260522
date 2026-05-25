import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth.module';
import { AdminService } from './application/use-cases/admin.service';
import { SequenceConfigService } from './application/use-cases/sequence-config.service';
import { AdminController } from './presentation/controllers/admin.controller';
import { AdminGuard } from './presentation/guards/admin.guard';
import {
  AgentEntity,
  AgentSecretSequenceEntity,
  MessageEntity,
  PairingEntity,
} from './infrastructure/database/entities';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      AgentEntity,
      AgentSecretSequenceEntity,
      PairingEntity,
      MessageEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, SequenceConfigService, AdminGuard],
  exports: [SequenceConfigService],
})
export class AdminModule {}
