import { STAGES } from './StageConfigs';
import type { StageConfig } from './types';

export class StageManager {
  index = 0;
  constructor(readonly stages: StageConfig[] = STAGES) {}
  get current(): StageConfig { return this.stages[this.index]; }
  get isLast() { return this.index >= this.stages.length - 1; }
  get next(): StageConfig | null { return this.stages[this.index + 1] ?? null; }
  reset() { this.index = 0; }
  /** Move to the next stage. False when the world tour is finished. */
  advance(): boolean {
    if (this.isLast) return false;
    this.index++;
    return true;
  }
}
