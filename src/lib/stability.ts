export class StabilityGate {
  private candidate: string | null = null;
  private started = 0;
  private latched = false;
  private releasedAt: number | null = null;
  constructor(public holdMs = 900, public releaseMs = 600) {}

  update(id: string | null, now: number): { trigger: string | null; progress: number; latched: boolean } {
    if (!id) {
      this.candidate = null;
      if (this.releasedAt === null) this.releasedAt = now;
      if (now - this.releasedAt >= this.releaseMs) this.latched = false;
      return { trigger: null, progress: 0, latched: this.latched };
    }
    this.releasedAt = null;
    if (this.latched) return { trigger: null, progress: 1, latched: true };
    if (id !== this.candidate) { this.candidate = id; this.started = now; }
    const progress = Math.min(1, (now - this.started) / this.holdMs);
    if (progress < 1) return { trigger: null, progress, latched: false };
    this.latched = true;
    return { trigger: id, progress: 1, latched: true };
  }
  reset() { this.candidate = null; this.latched = false; this.releasedAt = null; this.started = 0; }
}
