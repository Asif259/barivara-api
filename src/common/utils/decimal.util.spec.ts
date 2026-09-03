import { DecimalUtil } from './decimal.util';

describe('DecimalUtil', () => {
  it('should correctly calculate rent total snapshot', () => {
    // 20,000 + 3,000 + 2,000 + 500 = 25,500
    const total = DecimalUtil.calculateRentTotal({
      rent: 20000,
      serviceFee: 3000,
      parkingFee: 2000,
      extraCharge: 500,
      lateFee: 0,
      discount: 0,
    });

    expect(total.toNumber()).toBe(25500);
    expect(DecimalUtil.toFixed(total)).toBe('25500.00');
  });

  it('should correctly deduct discount and add late fee', () => {
    // 25,500 - 500 discount + 200 late fee = 25,200
    const total = DecimalUtil.calculateRentTotal({
      rent: 20000,
      serviceFee: 3000,
      parkingFee: 2000,
      extraCharge: 500,
      lateFee: 200,
      discount: 500,
    });

    expect(total.toNumber()).toBe(25200);
  });

  it('should never produce negative total when discount exceeds charges', () => {
    const total = DecimalUtil.calculateRentTotal({
      rent: 5000,
      discount: 10000,
    });

    expect(total.toNumber()).toBe(0);
  });

  it('should calculate remaining balance without floating point inaccuracy', () => {
    // 25,500 - 20,000 = 5,500
    const remaining1 = DecimalUtil.calculateRemaining(25500, 20000);
    expect(remaining1.toNumber()).toBe(5500);

    // 25,500 - 25,500 = 0
    const remaining2 = DecimalUtil.calculateRemaining(25500, 25500);
    expect(remaining2.toNumber()).toBe(0);

    // Floating precision test: 0.1 + 0.2 arithmetic in JS
    const remaining3 = DecimalUtil.calculateRemaining('100.30', '100.10');
    expect(remaining3.toFixed(2)).toBe('0.20');
  });
});
