import type { PairingStatus } from '../constants/status';
import type { AgentPublicProfile } from './agent';

export interface Pairing {
  externalId: string;
  status: PairingStatus;
  peer: AgentPublicProfile;
  isRequester: boolean;
  requestedAt: string;
  acceptedAt?: string;
  endedAt?: string;
}
