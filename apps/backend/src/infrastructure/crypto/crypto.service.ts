import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomUUID,
} from 'node:crypto';

const BCRYPT_COST = 12;
const GCM_IV_LEN = 12;
const GCM_TAG_LEN = 16;
const SEQUENCE_SALT_LEN = 16;

@Injectable()
export class CryptoService {
  private readonly messageKey: Buffer;
  private readonly sequenceHmacKey: Buffer;

  constructor(config: ConfigService) {
    const msgKey = config.get<string>('MESSAGE_ENC_KEY') ?? '';
    const seqKey = config.get<string>('SEQUENCE_HMAC_KEY') ?? '';

    if (msgKey === 'REPLACE_WITH_BASE64_32BYTES' || msgKey === '') {
      const fallback = randomBytes(32).toString('base64');
      // eslint-disable-next-line no-console
      console.warn(
        `[crypto] MESSAGE_ENC_KEY not set, using dev fallback (this is fine for dev only). Add to .env: MESSAGE_ENC_KEY=${fallback}`,
      );
      this.messageKey = Buffer.from(fallback, 'base64');
    } else {
      const buf = Buffer.from(msgKey, 'base64');
      if (buf.length !== 32) {
        throw new Error(`MESSAGE_ENC_KEY must be 32 bytes (base64). got ${buf.length} bytes`);
      }
      this.messageKey = buf;
    }

    this.sequenceHmacKey = Buffer.from(seqKey || randomBytes(32).toString('hex'));
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_COST);
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  /** AES-256-GCM 암호화 — REQ-016 / SEC-002. */
  encryptMessage(plain: string): { ciphertext: Buffer; iv: Buffer; tag: Buffer } {
    const iv = randomBytes(GCM_IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', this.messageKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext, iv, tag };
  }

  decryptMessage(ciphertext: Buffer, iv: Buffer, tag: Buffer): string {
    const decipher = createDecipheriv('aes-256-gcm', this.messageKey, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString('utf8');
  }

  /** 시퀀스 해시 — HMAC-SHA256 + 16B salt. SEC-009 / REQ-006. */
  hashSequence(sequence: number[]): { hash: Buffer; salt: Buffer } {
    const salt = randomBytes(SEQUENCE_SALT_LEN);
    return { hash: this.computeSequenceHash(sequence, salt), salt };
  }

  verifySequence(sequence: number[], hash: Buffer, salt: Buffer): boolean {
    const candidate = this.computeSequenceHash(sequence, salt);
    if (candidate.length !== hash.length) return false;
    // timing-safe compare
    let diff = 0;
    for (let i = 0; i < candidate.length; i++) diff |= candidate[i]! ^ hash[i]!;
    return diff === 0;
  }

  private computeSequenceHash(sequence: number[], salt: Buffer): Buffer {
    const data = Buffer.concat([salt, Buffer.from(sequence.join(','), 'utf8')]);
    return createHmac('sha256', this.sequenceHmacKey).update(data).digest();
  }

  newUuid(): string {
    return randomUUID();
  }
}
