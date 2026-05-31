import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavigationPanel from './NavigationPanel';
import type { RouteData } from '@/lib/mapbox-directions';

afterEach(cleanup);

const route: RouteData = {
  geometry: { type: 'LineString', coordinates: [] },
  duration: 720,
  distance: 8400,
  steps: [
    { instruction: 'Turn left onto Main Street', name: 'Main Street', distance: 400, maxspeedKmh: 50, maneuverModifier: 'left', lanes: [] },
    { instruction: 'Turn right onto Oak Ave', name: 'Oak Ave', distance: 1600, maxspeedKmh: 50, maneuverModifier: 'right', lanes: [] },
    { instruction: 'Merge onto Highway 7', name: 'Highway 7', distance: 4000, maxspeedKmh: 90, maneuverModifier: 'straight', lanes: [] },
  ],
};

describe('NavigationPanel', () => {
  it('shows the hero distance with a separate unit', () => {
    render(<NavigationPanel route={route} gpsSpeed={48} onEnd={() => {}} />);
    expect(screen.getByText('400')).toBeInTheDocument();
    expect(screen.getByText('m')).toBeInTheDocument();
  });

  it('shows the current instruction and an upcoming list', () => {
    render(<NavigationPanel route={route} gpsSpeed={48} onEnd={() => {}} />);
    expect(screen.getByText('Turn left onto Main Street')).toBeInTheDocument();
    expect(screen.getByText('Oak Ave')).toBeInTheDocument();
    expect(screen.getByText('Highway 7')).toBeInTheDocument();
  });

  it('calls onEnd when End is tapped', async () => {
    const onEnd = vi.fn();
    render(<NavigationPanel route={route} gpsSpeed={48} onEnd={onEnd} />);
    await userEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
