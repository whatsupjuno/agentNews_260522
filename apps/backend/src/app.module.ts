import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseConfig } from './infrastructure/database/database.config';
import { CryptoModule } from './infrastructure/crypto/crypto.module';
import { PushModule } from './infrastructure/push/push.module';
import { DemoModule } from './infrastructure/demo/demo.module';
import { AuthModule } from './auth.module';
import { NewsModule } from './news.module';
import { SequenceModule } from './sequence.module';
import { MessageModule } from './message.module';
import { UserModule } from './user.module';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TypeOrmModule.forRootAsync({ useClass: DatabaseConfig }),
    CryptoModule,
    PushModule,
    DemoModule,
    AuthModule,
    NewsModule,
    SequenceModule,
    MessageModule,
    UserModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
