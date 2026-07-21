import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmButton } from './ConfirmButton';

describe('ConfirmButton', () => {
  it('initially shows only the label button', () => {
    render(<ConfirmButton label="Deactivate" onConfirm={vi.fn()} />);
    expect(screen.getByText('Deactivate')).toBeInTheDocument();
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('reveals Confirm/Cancel on click without calling onConfirm', () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton label="Deactivate" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Deactivate'));

    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Cancel reverts to the initial label without calling onConfirm', () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton label="Deactivate" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Deactivate'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.getByText('Deactivate')).toBeInTheDocument();
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Confirm calls onConfirm', () => {
    const onConfirm = vi.fn();
    render(<ConfirmButton label="Deactivate" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByText('Deactivate'));
    fireEvent.click(screen.getByText('Confirm'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables both inner buttons and shows the busy label when busy', () => {
    render(<ConfirmButton label="Deactivate" busy onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByText('Deactivate'));

    const workingButton = screen.getByText('Working…');
    const cancelButton = screen.getByText('Cancel');
    expect(workingButton).toBeDisabled();
    expect(cancelButton).toBeDisabled();
  });
});
