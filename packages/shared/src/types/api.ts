/**
 * 공통 응답 envelope — development_conventions §4.
 * 백엔드는 모든 응답을 이 형태로 wrap. 모바일은 동일 형태로 unwrap.
 */
export interface ApiMeta {
  timestamp: string;
  traceId: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId: string;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** 위장 응답 코드 — 비밀 도메인 endpoint 의 모든 권한 거부 단일 형태 */
export const DISGUISE_ERROR_CODE = 'NEWS_ARTICLE_NOT_FOUND';
