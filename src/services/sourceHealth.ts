export interface SourceHealthRecord {
  domain: string;
  sourceName: string;
  totalChecks: number;
  successfulChecks: number;
  consecutiveFailures: number;
  lastCheckedAt: number;
  lastSuccessAt?: number;
  lastErrorMessage?: string;
  healthStatus: 'healthy' | 'degraded' | 'offline';
  recommendedBackoffMinutes: number;
}

// In-memory cache persisted to chrome.storage.local
const healthMap = new Map<string, SourceHealthRecord>();

export async function recordSourceCheckResult(
  domain: string,
  sourceName: string,
  success: boolean,
  errorMessage?: string
): Promise<SourceHealthRecord> {
  let record = healthMap.get(domain) || {
    domain,
    sourceName,
    totalChecks: 0,
    successfulChecks: 0,
    consecutiveFailures: 0,
    lastCheckedAt: Date.now(),
    healthStatus: 'healthy' as const,
    recommendedBackoffMinutes: 60,
  };

  record.totalChecks++;
  record.lastCheckedAt = Date.now();

  if (success) {
    record.successfulChecks++;
    record.consecutiveFailures = 0;
    record.lastSuccessAt = Date.now();
    record.lastErrorMessage = undefined;
    record.healthStatus = 'healthy';
    record.recommendedBackoffMinutes = 60;
  } else {
    record.consecutiveFailures++;
    record.lastErrorMessage = errorMessage;
    if (record.consecutiveFailures >= 5) {
      record.healthStatus = 'offline';
      record.recommendedBackoffMinutes = 360; // 6 hours
    } else if (record.consecutiveFailures >= 2) {
      record.healthStatus = 'degraded';
      record.recommendedBackoffMinutes = 120; // 2 hours
    }
  }

  healthMap.set(domain, record);
  return record;
}

export function getSourceHealth(domain: string): SourceHealthRecord | undefined {
  return healthMap.get(domain);
}

export function getAllSourceHealth(): SourceHealthRecord[] {
  return Array.from(healthMap.values());
}
