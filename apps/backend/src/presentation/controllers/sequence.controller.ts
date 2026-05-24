import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { SequenceService } from '../../application/use-cases/sequence.service';
import { VerifySequenceDto } from '../dto/sequence.dto';
import { AuthedRequest, JwtAuthGuard } from '../guards/jwt-auth.guard';

@Controller('sequence')
@UseGuards(JwtAuthGuard)
export class SequenceController {
  constructor(private readonly seq: SequenceService) {}

  /**
   * `/sequence/verify` 는 위장 도메인이 아님 (handoff §10).
   * 그러나 실패 응답은 위장 — DisguiseExceptionFilter 가 path 매칭 안 함 → 일반 401 응답.
   * Phase 1 데모: 회원가입 후 [5,3,1,7] 자동 등록되어 있음.
   */
  @Post('verify')
  async verify(@Req() req: AuthedRequest, @Body() dto: VerifySequenceDto) {
    return this.seq.verify(req.agent.id, dto.sequence);
  }

  @Post('register')
  async register(@Req() req: AuthedRequest, @Body() dto: VerifySequenceDto) {
    await this.seq.register(req.agent.id, dto.sequence);
    return { ok: true };
  }
}
