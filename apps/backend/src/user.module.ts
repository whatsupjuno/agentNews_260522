import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth.module';
import { UserService } from './application/use-cases/user.service';
import { UserController } from './presentation/controllers/user.controller';
import {
  AgentEntity,
  MessageEntity,
  PairingEntity,
} from './infrastructure/database/entities';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([AgentEntity, PairingEntity, MessageEntity]),
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
