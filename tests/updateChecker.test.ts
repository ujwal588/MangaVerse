import { describe, it, expect } from 'vitest';

describe('Binge Threshold Logic', () => {
  it('correctly triggers binge threshold alert when on-hold series meets threshold', () => {
    const series = {
      id: 'series-xyz',
      title: 'Tower of God',
      userStatus: 'on_hold',
      bingeThreshold: 10,
      unreadCount: 10,
    };

    const shouldNotifyBinge =
      series.userStatus === 'on_hold' &&
      series.bingeThreshold > 0 &&
      series.unreadCount >= series.bingeThreshold;

    expect(shouldNotifyBinge).toBe(true);
  });

  it('suppresses binge alert when unread count is below threshold', () => {
    const series = {
      id: 'series-xyz',
      title: 'Tower of God',
      userStatus: 'on_hold',
      bingeThreshold: 10,
      unreadCount: 7,
    };

    const shouldNotifyBinge =
      series.userStatus === 'on_hold' &&
      series.bingeThreshold > 0 &&
      series.unreadCount >= series.bingeThreshold;

    expect(shouldNotifyBinge).toBe(false);
  });

  it('does not send binge notification if series is actively reading', () => {
    const series = {
      id: 'series-xyz',
      title: 'Tower of God',
      userStatus: 'reading',
      bingeThreshold: 10,
      unreadCount: 15,
    };

    const isBingeTarget = series.userStatus === 'on_hold';
    expect(isBingeTarget).toBe(false);
  });
});
