import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('should not render when open is false', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Test Title"
        message="Test Message"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
  });

  it('should render when open is true', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        message="Test Message"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Message')).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        message="Test Message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const confirmButton = screen.getByText('确认');
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('should call onCancel when cancel button is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        message="Test Message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const cancelButton = screen.getByText('取消');
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('should use custom button text', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        message="Test Message"
        confirmText="Yes"
        cancelText="No"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('should apply danger styling when danger prop is true', () => {
    render(
      <ConfirmDialog
        open={true}
        title="Dangerous Action"
        message="This is dangerous"
        danger={true}
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );

    const confirmButton = screen.getByText('确认');
    expect(confirmButton.className).toContain('bg-red-500');
  });

  it('should call onCancel when pressing Escape key', () => {
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        message="Test Message"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when clicking backdrop', () => {
    const onCancel = vi.fn();

    const { container } = render(
      <ConfirmDialog
        open={true}
        title="Test Title"
        message="Test Message"
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    );

    // 点击背景遮罩
    const backdrop = container.querySelector('.absolute.inset-0');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    expect(onCancel).toHaveBeenCalled();
  });
});
