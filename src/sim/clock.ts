export class FixedClock {
  paused = false;
  /** Simulated seconds actually stepped (steps × step), not real time. */
  activeTime = 0;
  private acc = 0;

  constructor(
    private readonly step: number,
    private readonly maxSteps: number,
  ) {}

  /** Returns number of fixed steps to run; excess beyond maxSteps is dropped. */
  advance(realDtSec: number): number {
    if (this.paused) return 0;
    if (!Number.isFinite(realDtSec) || realDtSec < 0) return 0;
    this.acc += realDtSec;
    let n = Math.floor(this.acc / this.step + 1e-9);
    if (n > this.maxSteps) {
      n = this.maxSteps;
      this.acc = 0;
    } else {
      this.acc = Math.max(0, this.acc - n * this.step);
    }
    this.activeTime += n * this.step;
    return n;
  }
}
