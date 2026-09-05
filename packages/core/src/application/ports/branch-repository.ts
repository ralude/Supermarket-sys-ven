import type { Branch, BranchStatus } from '../../domain/config/index.js';

export interface BranchRepository {
  save(branch: Branch): Promise<void>;
  findById(branchId: string): Promise<Branch | null>;
  findByCode(code: string): Promise<Branch | null>;
  findAll(status?: BranchStatus): Promise<readonly Branch[]>;
}
