import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { NewsService } from './application/use-cases/news.service';
import { NewsController } from './presentation/controllers/news.controller';

@Module({
  imports: [AuthModule],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
