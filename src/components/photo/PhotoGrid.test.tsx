import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PhotoGrid from './PhotoGrid';
import type { Photo } from '@/types';

let lastComponents: unknown;

vi.mock('react-virtuoso', async () => {
  const React = await import('react');

  return {
    VirtuosoGrid: React.forwardRef((props: any, ref: any) => {
      lastComponents = props.components;

      if (ref) {
        const handle = {
          scrollTo: vi.fn(),
          scrollBy: vi.fn(),
          scrollToIndex: vi.fn(),
        };
        if (typeof ref === 'function') {
          ref(handle);
        } else {
          ref.current = handle;
        }
      }

      const Footer = props.components?.Footer;
      return (
        <div data-testid="virtuoso-grid">
          {Footer ? <Footer context={props.context} /> : null}
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

beforeEach(() => {
  lastComponents = undefined;
});

describe('PhotoGrid', () => {
  it('loading 切换不会导致 VirtuosoGrid components 变化', () => {
    const photos: Photo[] = [
      {
        photoId: 1,
        filePath: 'C:\\a.jpg',
        fileName: 'a.jpg',
        fileSize: 1,
        fileHash: 'hash',
        dateAdded: '2025-01-01T00:00:00Z',
        rating: 0,
        isFavorite: false,
        isDeleted: false,
      },
    ];

    const view = render(
      <MemoryRouter>
        <PhotoGrid photos={photos} loading={false} />
      </MemoryRouter>
    );
    const componentsBefore = lastComponents;

    expect(screen.queryByText('加载中...')).not.toBeInTheDocument();

    view.rerender(
      <MemoryRouter>
        <PhotoGrid photos={photos} loading={true} />
      </MemoryRouter>
    );

    expect(lastComponents).toBe(componentsBefore);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });
});
