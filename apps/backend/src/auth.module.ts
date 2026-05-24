import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './application/use-cases/auth.service';
import { AuthController } from './presentation/controllers/auth.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { UnlockTokenGuard } from './presentation/guards/unlock-token.guard';
import {
  AgentEntity,
  AgentSecretSequenceEntity,
  RefreshTokenEntity,
} from './infrastructure/database/entities';

@Module({
  imports: [
    JwtModule.register({}),
    TypeOrmModule.forFeature([AgentEntity, AgentSecretSequenceEntity, RefreshTokenEntity]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, UnlockTokenGuard],
  exports: [JwtAuthGuard, UnlockTokenGuard, JwtModule],
})
export class AuthModule {}
