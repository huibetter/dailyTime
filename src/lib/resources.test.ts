import { describe, expect, it } from 'vitest';
import { resourceFileName, resourceRelativePath } from './resources';

describe('resource paths', () => {
  it('uses an opaque resource id and a safe extension', () => {
    expect(resourceFileName('resource-1', '截图.final.PNG')).toBe('resource-1.PNG');
    expect(resourceRelativePath('doc/1', 'resource-1', '截图.png')).toBe(
      'resources/doc_1/resource-1.png',
    );
  });

  it('avoids collisions when names repeat', () => {
    const first = resourceRelativePath('doc-1', 'id-one', 'image.png');
    const second = resourceRelativePath('doc-1', 'id-two', 'image.png');
    expect(first).not.toBe(second);
  });
});
