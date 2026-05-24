import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      url:
        this.config.get<string>('DATABASE_URL') ??
        'postgresql://agentnews:agentnews_dev@localhost:5432/agentnews',
      autoLoadEntities: true,
      synchronize: false, // ddl.sql 이 schema 적재. migration 으로 추후 관리.
      logging: false, // dev 라도 noisy 줄임
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      migrationsRun: false,
    };
  }
}
