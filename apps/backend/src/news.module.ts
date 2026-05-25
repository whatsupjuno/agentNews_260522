import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { NewsService } from './application/use-cases/news.service';
import { NewsController } from './presentation/controllers/news.controller';
import { YonhapRssClient } from './infrastructure/news/yonhap-rss.client';

@Module({
  imports: [AuthModule],
  controllers: [NewsController],
  providers: [NewsService, YonhapRssClient],
})
export class NewsModule {}
