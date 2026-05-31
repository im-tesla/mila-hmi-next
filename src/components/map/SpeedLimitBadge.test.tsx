import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import SpeedLimitBadge from './SpeedLimitBadge';

afterEach(cleanup);

describe('SpeedLimitBadge', () => {
  it('renders live speed and MAX caption under the limit', () => {
    render(<SpeedLimitBadge speedKmh={48} limitKmh={50} />);
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('MAX 50')).toBeInTheDocument();
    expect(screen.getByTestId('speed-badge').getAttribute('data-over')).toBe('false');
  });

  it('marks over-limit when speed exceeds the limit', () => {
    render(<SpeedLimitBadge speedKmh={58} limitKmh={50} />);
    expect(screen.getByTestId('speed-badge').getAttribute('data-over')).toBe('true');
  });

  it('omits the MAX caption when no limit is known', () => {
    render(<SpeedLimitBadge speedKmh={42} limitKmh={null} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.queryByText(/MAX/)).toBeNull();
    expect(screen.getByTestId('speed-badge').getAttribute('data-over')).toBe('false');
  });

  it('renders nothing when neither speed nor limit is available', () => {
    const { container } = render(<SpeedLimitBadge speedKmh={null} limitKmh={null} />);
    expect(container.firstChild).toBeNull();
  });
});
