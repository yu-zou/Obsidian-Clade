import { describe, it, expect } from 'vitest';
import { parseHunks, applyAcceptedHunks, applyHunk } from '../src/diff-engine';
import type { AcpHunk, TrackedHunk } from '../src/types';

const h = (os: number, ol: number, ns: number, nl: number, lines: string[]): AcpHunk =>
  ({ oldStart: os, oldLines: ol, newStart: ns, newLines: nl, lines });

describe('parseHunks', () => {
  it('wraps into TrackedHunk with pending state and sequential indices', () => {
    const raw = [h(1, 1, 1, 1, ['-a', '+b']), h(3, 1, 3, 1, ['-c', '+d'])];
    const result = parseHunks(raw);
    expect(result).toHaveLength(2);
    expect(result[0].state).toBe('pending');
    expect(result[0].index).toBe(0);
    expect(result[1].index).toBe(1);
  });
});

describe('applyHunk', () => {
  it('applies a replacement', () => {
    expect(applyHunk('line 1\nline 2\nline 3', h(2, 1, 2, 1, ['-line 2', '+mod']), true))
      .toBe('line 1\nmod\nline 3');
  });

  it('applies an addition (no old lines)', () => {
    expect(applyHunk('line 1\nline 2', h(1, 0, 2, 1, ['+new']), true))
      .toBe('line 1\nnew\nline 2');
  });

  it('applies a deletion (no new lines)', () => {
    expect(applyHunk('line 1\nline 2\nline 3', h(2, 1, 2, 0, ['-line 2']), true))
      .toBe('line 1\nline 3');
  });

  it('returns original content when rejected', () => {
    const orig = 'line 1\nline 2';
    expect(applyHunk(orig, h(2, 1, 2, 1, ['-line 2', '+x']), false)).toBe(orig);
  });
});

describe('applyAcceptedHunks', () => {
  it('applies only accepted hunks, skips rejected and pending', () => {
    const orig = 'line 1\nline 2\nline 3\nline 4\nline 5';
    const hunks: TrackedHunk[] = [
      { index: 0, state: 'accepted', original: h(1, 1, 1, 1, ['-line 1', '+intro']) },
      { index: 1, state: 'rejected', original: h(3, 1, 3, 1, ['-line 3', '+middle']) },
      { index: 2, state: 'accepted', original: h(5, 1, 5, 1, ['-line 5', '+outro']) },
      { index: 3, state: 'pending', original: h(2, 0, 2, 1, ['+extra']) },
    ];
    expect(applyAcceptedHunks(orig, hunks)).toBe('intro\nline 2\nline 3\nline 4\noutro');
  });

  it('applies hunks in reverse order to preserve line numbers', () => {
    const orig = 'A\nB\nC\nD';
    const hunks: TrackedHunk[] = [
      { index: 0, state: 'accepted', original: h(1, 1, 1, 1, ['-A', '+Alpha']) },
      { index: 1, state: 'accepted', original: h(4, 1, 4, 1, ['-D', '+Delta']) },
    ];
    expect(applyAcceptedHunks(orig, hunks)).toBe('Alpha\nB\nC\nDelta');
  });
});
