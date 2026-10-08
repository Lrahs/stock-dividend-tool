import { describe, expect, it } from 'vitest';
import { appTitle, formatPercent, normalizeSharesToLots } from '../../src/renderer/app/App';

describe('app shell', () => {
  it('uses the approved product name', () => {
    expect(appTitle).toBe('攒股收息小工具');
  });

  it('shows dividend rates with two decimal places', () => {
    expect(formatPercent(0.046971)).toBe('4.70%');
  });

  it('rounds holding changes down to 100-share lots', () => {
    expect(normalizeSharesToLots(399)).toBe(300);
  });
});
