import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { NewsService } from '../../application/use-cases/news.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get('news/feed')
  feed() {
    return { articles: this.news.getFeed() };
  }

  @Get('articles/:id')
  article(@Param('id') id: string) {
    return this.news.getArticle(id);
  }
}
