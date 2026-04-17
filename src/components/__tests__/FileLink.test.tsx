import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileLink from '../FileLink';

describe('FileLink', () => {
  it('should display full path with line number', () => {
    const onNavigate = vi.fn();
    render(
      <FileLink path="src/foo.ts" line={42} onNavigate={onNavigate}>
        ignored text
      </FileLink>
    );

    expect(screen.getByText('src/foo.ts:42')).toBeInTheDocument();
  });

  it('should display full path without line number', () => {
    const onNavigate = vi.fn();
    render(
      <FileLink path="src/bar.ts" onNavigate={onNavigate}>
        ignored
      </FileLink>
    );

    expect(screen.getByText('src/bar.ts')).toBeInTheDocument();
  });

  it('should call onNavigate with path and line when clicked', () => {
    const onNavigate = vi.fn();
    render(
      <FileLink path="src/foo.ts" line={42} onNavigate={onNavigate}>
        ignored
      </FileLink>
    );

    const tag = screen.getByText('src/foo.ts:42');
    fireEvent.click(tag);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('src/foo.ts', 42);
  });

  it('should call onNavigate with line 1 when no line prop', () => {
    const onNavigate = vi.fn();
    render(
      <FileLink path="src/bar.ts" onNavigate={onNavigate}>
        ignored
      </FileLink>
    );

    const tag = screen.getByText('src/bar.ts');
    fireEvent.click(tag);

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('src/bar.ts', 1);
  });

  it('should use theme CSS variables and inline-flex styling', () => {
    const onNavigate = vi.fn();
    render(
      <FileLink path="src/test.ts" line={10} onNavigate={onNavigate}>
        ignored
      </FileLink>
    );

    const textEl = screen.getByText('src/test.ts:10');
    const tag = textEl.parentElement!;
    expect(tag.className).toContain('inline-flex');
    expect(tag.className).toContain('bg-bg-hover');
    expect(tag.className).toContain('text-blue-600');
    expect(tag.className).toContain('cursor-pointer');
    expect(tag.className).toContain('border-border-default');
    expect(tag.className).toContain('max-w-full');
  });
});
