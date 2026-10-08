import { describe, expect, it } from 'vitest';
import { pointEstimateG } from '../../src/main/market/forecast';

describe('点估计 G（抽样分布）', () => {
  it('返回样本均值为 G，并给出样本量与标准差', () => {
    const samples = [
      { g0: 100, g1: 105 }, // +5%
      { g0: 100, g1: 110 }, // +10%
      { g0: 100, g1: 120 }, // +20%
    ];
    const est = pointEstimateG(samples);
    expect(est).not.toBeNull();
    expect(est!.n).toBe(3);
    expect(est!.g).toBeCloseTo(0.11667, 3);
    expect(est!.sd).toBeGreaterThan(0);
  });

  it('样本为空时返回 null', () => {
    expect(pointEstimateG([])).toBeNull();
  });

  it('只有 1 家也可点估计（有几家就用几家），sd 为 0', () => {
    const est = pointEstimateG([{ g0: 100, g1: 110 }]);
    expect(est).not.toBeNull();
    expect(est!.n).toBe(1);
    expect(est!.g).toBeCloseTo(0.1, 6);
    expect(est!.sd).toBe(0);
  });

  it('不剔除最大/最小值，全部样本参与点估计', () => {
    const samples = [
      { g0: 100, g1: 100 }, // +0% (最小值)
      { g0: 100, g1: 200 }, // +100% (最大值)
      { g0: 100, g1: 101 }, // +1%
    ];
    const est = pointEstimateG(samples);
    expect(est).not.toBeNull();
    expect(est!.n).toBe(3);
    expect(est!.g).toBeCloseTo((0 + 1 + 0.01) / 3, 6);
  });
});
