interface RateLimiterOptions {
  requestsPerMinute: number;
  tokensPerMinute: number;
}

export class RateLimiter {
  private requestsPerMinute: number;
  private tokensPerMinute: number;

  private requestTimestamps: number[] = [];
  private tokenTimestamps: Array<{ ts: number; tokens: number }> = [];

  constructor(options: RateLimiterOptions) {
    this.requestsPerMinute = options.requestsPerMinute;
    this.tokensPerMinute = options.tokensPerMinute;
  }

  async waitForRequest(estimatedTokens: number): Promise<void> {
    await this.waitForRequestSlot();
    await this.waitForTokenSlot(estimatedTokens);
    const now = Date.now();
    this.requestTimestamps.push(now);
    this.tokenTimestamps.push({ ts: now, tokens: estimatedTokens });
  }

  recordUsage(tokens: number): void {
    const now = Date.now();
    this.tokenTimestamps.push({ ts: now, tokens });
  }

  private prune(): void {
    const cutoff = Date.now() - 60_000;
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > cutoff);
    this.tokenTimestamps = this.tokenTimestamps.filter(e => e.ts > cutoff);
  }

  private async waitForRequestSlot(): Promise<void> {
    while (true) {
      this.prune();
      if (this.requestTimestamps.length < this.requestsPerMinute) return;
      const oldest = this.requestTimestamps[0]!;
      const wait = oldest + 60_000 - Date.now() + 50;
      if (wait > 0) await sleep(wait);
    }
  }

  private async waitForTokenSlot(needed: number): Promise<void> {
    while (true) {
      this.prune();
      const used = this.tokenTimestamps.reduce((sum, e) => sum + e.tokens, 0);
      if (used + needed <= this.tokensPerMinute) return;
      const oldest = this.tokenTimestamps[0]!;
      const wait = oldest.ts + 60_000 - Date.now() + 50;
      if (wait > 0) await sleep(wait);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const gpt4oMiniLimiter = new RateLimiter({
  requestsPerMinute: 500,
  tokensPerMinute: 200_000,
});

export const embeddingLimiter = new RateLimiter({
  requestsPerMinute: 3000,
  tokensPerMinute: 1_000_000,
});
