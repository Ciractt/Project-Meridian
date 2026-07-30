import { describe, it, expect } from 'vitest';
import { carriersMissingFrom } from './unavailable-carriers';

/**
 * The notice has to be right in both directions.
 *
 * Naming an airline on a route it doesn't fly makes the warning noise, and noise
 * is how a genuine one stops being read. Failing to name it where it does fly is
 * the omission the notice exists to prevent.
 */
describe('carriers missing from a route', () => {
  it('names them on a UK to Europe route', () => {
    const names = carriersMissingFrom('NCL', 'AGP').map((c) => c.name);
    expect(names).toContain('Jet2');
    expect(names).toContain('Ryanair');
  });

  it('names them within Europe, not just from the UK', () => {
    expect(carriersMissingFrom('DUB', 'FAO')).not.toHaveLength(0);
  });

  it('says nothing on a long-haul route neither airline flies', () => {
    expect(carriersMissingFrom('LHR', 'JFK')).toHaveLength(0);
    expect(carriersMissingFrom('MAN', 'SIN')).toHaveLength(0);
  });

  it('covers the near-Europe markets low-cost carriers actually serve', () => {
    expect(carriersMissingFrom('LTN', 'RAK')).not.toHaveLength(0);
    expect(carriersMissingFrom('STN', 'AYT')).not.toHaveLength(0);
  });

  it('stays silent when an airport is unknown, rather than guessing', () => {
    expect(carriersMissingFrom('ZZZ', 'AGP')).toHaveLength(0);
    expect(carriersMissingFrom('NCL', 'QQQ')).toHaveLength(0);
  });

  it('does not name Wizz Air until its absence is confirmed', () => {
    const names = carriersMissingFrom('LTN', 'BUD').map((c) => c.name);
    expect(names).not.toContain('Wizz Air');
  });
});
