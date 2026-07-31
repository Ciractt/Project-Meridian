import { describe, expect, it } from 'vitest';
import { fromMinorUnits, toMinorUnits } from './money';

describe('toMinorUnits', () => {
  it('round-trips the amounts Duffel actually sends', () => {
    for (const value of ['0.00', '23.00', '184.50', '1234.99', '7']) {
      const minor = toMinorUnits(value);
      expect(minor).not.toBeNull();
      expect(Number(fromMinorUnits(minor!))).toBe(Number(value));
    }
  });

  it('refuses anything that is not a plain decimal', () => {
    for (const value of ['', 'GBP 23', '23,00', '1e3', 'NaN', '£23.00', '1.2345']) {
      expect(toMinorUnits(value)).toBeNull();
    }
  });
});

describe('adding amounts', () => {
  it('does not drift', () => {
    const total = toMinorUnits('184.50')! + toMinorUnits('23.00')!;
    expect(fromMinorUnits(total)).toBe('207.50');
  });

  it('survives the classic float case', () => {
    expect(Number('0.1') + Number('0.2')).not.toBe(0.3);
    const total = toMinorUnits('0.10')! + toMinorUnits('0.20')!;
    expect(fromMinorUnits(total)).toBe('0.30');
  });

  it('adds a seat to a fare the way the price panel does', () => {
    const fare = toMinorUnits('184.50')!;
    const seat = toMinorUnits('23.00')!;
    const bag = toMinorUnits('31.99')!;
    expect(fromMinorUnits(fare + seat + bag)).toBe('239.49');
  });
});
