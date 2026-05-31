import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavigationPanel from './NavigationPanel';
import type { RouteData } from '@/lib/mapbox-directions';

afterEach(cleanup);

function makeRoute(overrides: Partial<RouteData> = {}): RouteData {
  return {
    geometry: { type: 'LineString', coordinates: [] },
    duration: 720,
    distance: 8400,
    steps: [
      { instruction: 'Turn left onto Main Street', name: 'Main Street', distance: 400, maxspeedKmh: 50, maneuverModifier: 'left', lanes: [] },
      { instruction: 'Turn right onto Oak Ave', name: 'Oak Ave', distance: 1600, maxspeedKmh: 50, maneuverModifier: 'right', lanes: [] },
      { instruction: 'Merge onto Highway 7', name: 'Highway 7', distance: 4000, maxspeedKmh: 90, maneuverModifier: 'straight', lanes: [] },
      { instruction: 'Take Exit 12', name: 'Exit 12', distance: 9100, maxspeedKmh: 90, maneuverModifier: 'slight right', lanes: [] },
    ],
    ...overrides,
  };
}

describe('NavigationPanel', () => {
  it('shows the hero distance with a separate unit', () => {
    render(<NavigationPanel route={makeRoute()} gpsSpeed={48} onEnd={() => {}} />);
    expect(screen.getByText('400')).toBeInTheDocument();
    expect(screen.getByText('m')).toBeInTheDocument();
  });

  it('shows the current instruction and the then-preview', () => {
    render(<NavigationPanel route={makeRoute()} gpsSpeed={48} onEnd={() => {}} />);
    expect(screen.getByText('Turn left onto Main Street')).toBeInTheDocument();
    expect(screen.getByText(/then turn right onto Oak Ave/i)).toBeInTheDocument();
  });

  it('lists upcoming steps after the next one, without duplicating it', () => {
    render(<NavigationPanel route={makeRoute()} gpsSpeed={48} onEnd={() => {}} />);
    expect(screen.getByText('Highway 7')).toBeInTheDocument();
    expect(screen.getByText('Exit 12')).toBeInTheDocument();
    // Oak Ave is the "then" step; it must NOT appear as its own upcoming row
    expect(screen.queryByText('Oak Ave')).toBeNull();
  });

  it('falls back to "Continue on current road" with a single step', () => {
    const route = makeRoute({ steps: [makeRoute().steps[0]] });
    render(<NavigationPanel route={route} gpsSpeed={null} onEnd={() => {}} />);
    expect(screen.getByText('Continue on current road')).toBeInTheDocument();
  });

  it('renders without crashing when there are no steps', () => {
    const route = makeRoute({ steps: [] });
    render(<NavigationPanel route={route} gpsSpeed={null} onEnd={() => {}} />);
    expect(screen.getByText('Starting route…')).toBeInTheDocument();
  });

  it('calls onEnd when End is tapped', async () => {
    const onEnd = vi.fn();
    render(<NavigationPanel route={makeRoute()} gpsSpeed={48} onEnd={onEnd} />);
    await userEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
