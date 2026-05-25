import { Controller, Get, UseGuards } from '@nestjs/common';
import { SequenceConfigService } from '../../application/use-cases/sequence-config.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/**
 * 모바일 측이 부팅 시 시퀀스 config (chat/admin) 을 fetch.
 * Admin 전용 X — 일반 인증 사용자도 chat sequence 알 수 있어야 verify 가능.
 *
 * 보안 메모: chat sequence 가 평문 노출 = admin 이 사용자 시퀀스를 강제 설정한 것과 동일.
 * SEC-009 (시퀀스 평문 저장 금지) 와 충돌 가능성 — Phase 1 데모 한정.
 * 운영 시: per-user sequence 만 사용 + global default 제거.
 */
@Controller('sequence')
@UseGuards(JwtAuthGuard)
export class SequenceConfigController {
  constructor(private readonly seqConfig: SequenceConfigService) {}

  @Get('config')
  config() {
    return this.seqConfig.getConfig();
  }
}
