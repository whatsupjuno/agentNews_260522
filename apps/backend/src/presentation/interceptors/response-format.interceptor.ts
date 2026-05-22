import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, map } from 'rxjs';
import { randomUUID } from 'node:crypto';

/**
 * 성공 응답 포맷 통일 — dev_conventions §4-1.
 * 컨트롤러가 raw 객체를 반환해도 { success, data, meta } 로 감쌈.
 */
@Injectable()
export class ResponseFormatInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const traceId = (request.headers['x-trace-id'] as string | undefined) ?? randomUUID();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString(), traceId },
      })),
    );
  }
}
