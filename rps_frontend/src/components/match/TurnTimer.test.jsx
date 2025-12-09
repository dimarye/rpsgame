import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TurnTimer from './TurnTimer';

// Mock timers
vi.useFakeTimers();

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('TurnTimer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders timer with initial time', () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={30} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByRole('timer')).toBeInTheDocument();
    });

    it('shows correct time format', () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={90} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      expect(screen.getByText('1:30')).toBeInTheDocument();
    });

    it('does not render when not active', () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={30} 
          onTimeout={vi.fn()} 
          isActive={false} 
        />
      );
      
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    });
  });

  describe('Timer Functionality', () => {
    it('counts down every second when active', async () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={5} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      expect(screen.getByText('5')).toBeInTheDocument();
      
      // Advance time by 1 second
      vi.advanceTimersByTime(1000);
      
      await waitFor(() => {
        expect(screen.getByText('4')).toBeInTheDocument();
      });
      
      // Advance another second
      vi.advanceTimersByTime(1000);
      
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });

    it('calls onTimeout when timer reaches zero', async () => {
      const onTimeout = vi.fn();
      
      renderWithRouter(
        <TurnTimer 
          initialTime={2} 
          onTimeout={onTimeout} 
          isActive={true} 
        />
      );
      
      // Advance time to zero
      vi.advanceTimersByTime(2000);
      
      await waitFor(() => {
        expect(onTimeout).toHaveBeenCalledTimes(1);
      });
    });

    it('stops counting when deactivated', async () => {
      const { rerender } = renderWithRouter(
        <TurnTimer 
          initialTime={5} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      // Advance time
      vi.advanceTimersByTime(1000);
      
      await waitFor(() => {
        expect(screen.getByText('4')).toBeInTheDocument();
      });
      
      // Deactivate timer
      rerender(
        <BrowserRouter>
          <TurnTimer 
            initialTime={5} 
            onTimeout={vi.fn()} 
            isActive={false} 
          />
        </BrowserRouter>
      );
      
      // Advance more time (should not count down)
      vi.advanceTimersByTime(2000);
      
      // Timer should not be visible when inactive
      expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    });

    it('resets timer when initialTime changes', async () => {
      const { rerender } = renderWithRouter(
        <TurnTimer 
          initialTime={5} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      // Advance time
      vi.advanceTimersByTime(2000);
      
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });
      
      // Change initial time
      rerender(
        <BrowserRouter>
          <TurnTimer 
            initialTime={10} 
            onTimeout={vi.fn()} 
            isActive={true} 
          />
        </BrowserRouter>
      );
      
      // Should show new time
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  describe('Visual States', () => {
    it('shows warning state when time is low', async () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={10} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      // Advance to warning time (5 seconds)
      vi.advanceTimersByTime(5000);
      
      await waitFor(() => {
        const timer = screen.getByRole('timer');
        expect(timer).toHaveClass('text-warning');
      });
    });

    it('shows danger state when time is critical', async () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={10} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      // Advance to critical time (3 seconds)
      vi.advanceTimersByTime(7000);
      
      await waitFor(() => {
        const timer = screen.getByRole('timer');
        expect(timer).toHaveClass('text-danger');
      });
    });

    it('shows pulsing animation when time is very low', async () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={10} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      // Advance to very low time (1 second)
      vi.advanceTimersByTime(9000);
      
      await waitFor(() => {
        const timer = screen.getByRole('timer');
        expect(timer).toHaveClass('animate-pulse');
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('cleans up timer on unmount', () => {
      const { unmount } = renderWithRouter(
        <TurnTimer 
          initialTime={30} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      // Timer should be running
      expect(screen.getByRole('timer')).toBeInTheDocument();
      
      // Unmount component
      unmount();
      
      // Advance time (should not cause errors)
      vi.advanceTimersByTime(1000);
      
      // No assertions needed - just checking no errors thrown
    });

    it('handles rapid activation/deactivation', async () => {
      const { rerender } = renderWithRouter(
        <TurnTimer 
          initialTime={10} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      // Rapidly toggle active state
      for (let i = 0; i < 5; i++) {
        rerender(
          <BrowserRouter>
            <TurnTimer 
              initialTime={10} 
              onTimeout={vi.fn()} 
              isActive={false} 
            />
          </BrowserRouter>
        );
        
        rerender(
          <BrowserRouter>
            <TurnTimer 
              initialTime={10} 
              onTimeout={vi.fn()} 
              isActive={true} 
            />
          </BrowserRouter>
        );
      }
      
      // Should still show correct time
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero initial time', () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={0} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('handles very large time values', () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={3600} // 1 hour
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      expect(screen.getByText('60:00')).toBeInTheDocument();
    });

    it('handles negative time values gracefully', () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={-5} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('handles missing onTimeout callback', () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={1} 
          isActive={true} 
        />
      );
      
      // Should not throw error when timeout occurs
      vi.advanceTimersByTime(1000);
      
      // No error should be thrown
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={30} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      const timer = screen.getByRole('timer');
      expect(timer).toHaveAttribute('aria-label', 'Turn timer');
      expect(timer).toHaveAttribute('aria-live', 'polite');
    });

    it('announces time changes to screen readers', async () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={5} 
          onTimeout={vi.fn()} 
          isActive={true} 
        />
      );
      
      const timer = screen.getByRole('timer');
      
      // Initial announcement
      expect(timer).toHaveAttribute('aria-label', 'Turn timer: 5 seconds remaining');
      
      // Time change announcement
      vi.advanceTimersByTime(1000);
      
      await waitFor(() => {
        expect(timer).toHaveAttribute('aria-label', 'Turn timer: 4 seconds remaining');
      });
    });
  });

  describe('Custom Props', () => {
    it('applies custom className', () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={30} 
          onTimeout={vi.fn()} 
          isActive={true} 
          className="custom-timer-class"
        />
      );
      
      const timer = screen.getByRole('timer');
      expect(timer).toHaveClass('custom-timer-class');
    });

    it('applies custom style', () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={30} 
          onTimeout={vi.fn()} 
          isActive={true} 
          style={{ fontSize: '24px' }}
        />
      );
      
      const timer = screen.getByRole('timer');
      expect(timer).toHaveStyle({ fontSize: '24px' });
    });

    it('shows custom label', () => {
      renderWithRouter(
        <TurnTimer 
          initialTime={30} 
          onTimeout={vi.fn()} 
          isActive={true} 
          label="Custom Timer"
        />
      );
      
      expect(screen.getByText('Custom Timer')).toBeInTheDocument();
    });
  });
});
