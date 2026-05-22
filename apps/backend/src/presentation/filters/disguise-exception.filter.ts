import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Reflector } from '@nestjs/core';

export const DISGUISE_ON_ERROR_KEY = 'disguise:onError';

/**
 * 위장 응답 필터 — 비밀 도메인 endpoint (`@DisguiseOnError()` 또는 라우트 경로 매칭) 의
 * 모든 권한 거부 / 미발견 / unlock 만료를 단일 `404 NEWS_ARTICLE_NOT_FOUND` 로 변환.
 *
 * dev_conventions §4-3 / SEC-006 / REQ-009.
 */
@Catch()
export class DisguiseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DisguiseExceptionFilter.name);
  private readonly reflector = new Reflector();

  private static readonly DISGUISE_ROUTE_PATTERNS = [
    /^\/api\/v1\/unlock(\/|$)/,
    /^\/api\/v1\/pairings(\/|$)/,
    /^\/api\/v1\/messages(\/|$)/,
    /^\/api\/v1\/attachments(\/|$)/,
  ];

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const traceId = (request.headers['x-trace-id'] as string | undefined) ?? randomUUID();
    const timestamp = new Date().toISOString();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const innerResponse = isHttp ? exception.getResponse() : null;

    const shouldDisguise = this.isDisguiseRoute(request.path) && status >= 400;

    if (shouldDisguise) {
      this.logger.warn(
        `disguise: ${request.method} ${request.path} → 404 NEWS_ARTICLE_NOT_FOUND (origin=${status}) traceId=${traceId}`,
      );
      response.status(HttpStatus.NOT_FOUND).json({
        success: false,
        error: {
          code: 'NEWS_ARTICLE_NOT_FOUND',
          message: '기사를 찾을 수 없습니다.',
          traceId,
        },
        meta: { timestamp },
      });
      return;
    }

    const errorPayload =
      isHttp && typeof innerResponse === 'object' && innerResponse !== null
        ? (innerResponse as Record<string, unknown>)
        : { message: 'Internal server error' };

    response.status(status).json({
      success: false,
      error: {
        code: (errorPayload.code as string | undefined) ?? `HTTP_${status}`,
        message: (errorPayload.message as string | undefined) ?? 'error',
        details: errorPayload.details,
        traceId,
      },
      meta: { timestamp },
    });

    if (status >= 500) {
      this.logger.error(exception);
    }
  }

  private isDisguiseRoute(path: string): boolean {
    return DisguiseExceptionFilter.DISGUISE_ROUTE_PATTERNS.some((re) => re.test(path));
  }
}
