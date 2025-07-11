import { cn } from './utils';

describe('cn', () => {
  it('fusionne deux classes CSS', () => {
    expect(cn('a', 'b')).toBe('a b');
  });
}); 