import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from './clipboard';

describe('copyToClipboard', () => {
  const originalNavigator = global.navigator;
  const originalDocument = global.document;

  afterEach(() => {
    Object.defineProperty(global, 'navigator', { value: originalNavigator, configurable: true, writable: true });
    Object.defineProperty(global, 'document', { value: originalDocument, configurable: true, writable: true });
  });

  it('uses navigator.clipboard.writeText when available', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global, 'navigator', {
      value: { clipboard: { writeText: writeTextMock } },
      configurable: true,
      writable: true,
    });

    const result = await copyToClipboard('test prompt');
    expect(result).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith('test prompt');
  });

  it('falls back to execCommand when navigator.clipboard is undefined (insecure context)', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    });

    const appendChildMock = vi.fn();
    const removeChildMock = vi.fn();
    const execCommandMock = vi.fn().mockReturnValue(true);

    Object.defineProperty(global, 'document', {
      value: {
        createElement: () => ({
          style: {},
          setAttribute: vi.fn(),
          focus: vi.fn(),
          select: vi.fn(),
          setSelectionRange: vi.fn(),
        }),
        body: {
          appendChild: appendChildMock,
          removeChild: removeChildMock,
        },
        execCommand: execCommandMock,
      },
      configurable: true,
      writable: true,
    });

    const result = await copyToClipboard('fallback text');
    expect(result).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');
    expect(appendChildMock).toHaveBeenCalled();
    expect(removeChildMock).toHaveBeenCalled();
  });
});
