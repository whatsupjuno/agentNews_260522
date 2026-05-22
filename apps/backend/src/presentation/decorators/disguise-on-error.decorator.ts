import { SetMetadata } from '@nestjs/common';
import { DISGUISE_ON_ERROR_KEY } from '../filters/disguise-exception.filter';

/**
 * 비밀 도메인 라우트에 부착. 권한 거부 / 미발견 등 4xx 오류를
 * `DisguiseExceptionFilter` 가 `404 NEWS_ARTICLE_NOT_FOUND` 로 변환.
 */
export const DisguiseOnError = (): MethodDecorator & ClassDecorator =>
  SetMetadata(DISGUISE_ON_ERROR_KEY, true);
