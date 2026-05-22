import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      url: this.config.get<string>('DATABASE_URL'),
      autoLoadEntities: true,
      synchronize: false,
      logging: this.config.get<string>('NODE_ENV') !== 'production',
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      migrationsRun: false,
    };
  }
}
