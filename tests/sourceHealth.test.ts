import { describe, it, expect } from 'vitest';
import { recordSourceCheckResult, getSourceHealth } from '../src/services/sourceHealth';

describe('Source Health and Backoff Monitor', () => {
  it('records successful check and marks source healthy', async () => {
    const res = await recordSourceCheckResult('mangadex.org', 'mangadex', true);
    expect(res.healthStatus).toBe('healthy');
    expect(res.successfulChecks).toBe(1);
    expect(res.consecutiveFailures).toBe(0);
    expect(res.recommendedBackoffMinutes).toBe(60);
  });

  it('marks source as degraded after consecutive failures', async () => {
    await recordSourceCheckResult('flaky-manga.com', 'flaky', false, 'Network Timeout');
    const res2 = await recordSourceCheckResult('flaky-manga.com', 'flaky', false, '503 Service Unavailable');
    expect(res2.healthStatus).toBe('degraded');
    expect(res2.consecutiveFailures).toBe(2);
    expect(res2.recommendedBackoffMinutes).toBe(120);
  });

  it('marks source as offline after 5 consecutive failures with extended backoff', async () => {
    for (let i = 0; i < 5; i++) {
      await recordSourceCheckResult('dead-domain.net', 'dead', false, 'Cloudflare block');
    }
    const health = getSourceHealth('dead-domain.net');
    expect(health?.healthStatus).toBe('offline');
    expect(health?.consecutiveFailures).toBe(5);
    expect(health?.recommendedBackoffMinutes).toBe(360);
  });
});
