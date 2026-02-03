import { render } from '@testing-library/react';
import { Icon } from './Icon';

describe('Icon', () => {
  it('should render aperture and iso as stroked icons', () => {
    const { container: apertureContainer } = render(<Icon name="aperture" />);
    const aperturePaths = apertureContainer.querySelectorAll('path');
    expect(aperturePaths.length).toBeGreaterThan(3);
    expect(Array.from(aperturePaths).some((p) => p.getAttribute('stroke') === 'currentColor')).toBe(true);

    const { container: isoContainer } = render(<Icon name="iso" />);
    const isoPaths = isoContainer.querySelectorAll('path');
    expect(isoPaths.length).toBeGreaterThan(3);
    expect(Array.from(isoPaths).some((p) => p.getAttribute('stroke') === 'currentColor')).toBe(true);
  });
});
