import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineView from './TimelineView';
import type { Photo } from '@/types';

vi.mock('react-virtuoso', async () => {
  const React = await import('react');

  return {
    Virtuoso: React.forwardRef((props: any, ref: any) => {
      if (ref) {
        const handle = { scrollTo: vi.fn() };
        if (typeof ref === 'function') {
          ref(handle);
        } else {
          ref.current = handle;
        }
      }

      const firstItem = typeof props.itemContent === 'function' ? props.itemContent(0) : null;
      const Footer = props.components?.Footer;

      return (
        <div data-testid="virtuoso">
          {firstItem}
          {Footer ? <Footer /> : null}
        </div>
      );
    }),
  };
});

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
    return window.setTimeout(() => cb(0), 0);
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    window.clearTimeout(id);
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('TimelineView', () => {
  it('grid items keep 1:1 aspect ratio to avoid tall-row stretching', () => {
    const photos: Photo[] = [
      {
        photoId: 1,
        filePath: 'C:\\a.jpg',
        fileName: 'a.jpg',
        fileSize: 1,
        fileHash: 'hash-a',
        dateAdded: '2025-01-01T00:00:00Z',
        rating: 0,
        isFavorite: false,
        isDeleted: false,
      },
      {
        photoId: 2,
        filePath: 'C:\\b.jpg',
        fileName: 'b.jpg',
        fileSize: 1,
        fileHash: 'hash-b',
        dateAdded: '2025-01-01T00:00:00Z',
        rating: 0,
        isFavorite: false,
        isDeleted: false,
      },
    ];

    render(
      <MemoryRouter>
        <TimelineView photos={photos} loading={false} />
      </MemoryRouter>
    );

    const firstThumbnail = screen.getAllByRole('button')[0];
    expect(firstThumbnail.parentElement?.style.aspectRatio).toBe('1 / 1');
  });
});

