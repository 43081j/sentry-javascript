import * as path from 'path';
import { Ignore } from 'glob';
import type { NormalizedOptions } from './options-mapping';

export type UploadFilter = (filePath: string) => boolean;

/**
 * Mirrors the glob of the upload from disk for files that are not on disk yet: a file is
 * uploaded when it matches one of `sourcemaps.assets` (all files when unset) and none of
 * `sourcemaps.ignore`.
 */
export function createUploadFilter(options: NormalizedOptions): UploadFilter {
  const assets = options.sourcemaps?.assets;
  // Like `glob`, `assets` skips dot files and folders unless a pattern names them, and `ignore` matches them.
  const matchesAssets = assets === undefined ? () => true : createMatcher(toArray(assets), { dot: false });
  const ignore = toArray(options.sourcemaps?.ignore ?? []);
  const matchesIgnore = ignore.length === 0 ? () => false : createMatcher(ignore, { dot: true });

  return filePath => matchesAssets(filePath) && !matchesIgnore(filePath);
}

// `glob` exports the matcher behind its `ignore` option. It resolves relative patterns against
// the working directory and accepts absolute ones, so both options follow the rules of the
// upload from disk.
function createMatcher(patterns: string[], { dot }: { dot: boolean }): UploadFilter {
  const matcher = new Ignore([], { nocase: process.platform === 'darwin' || process.platform === 'win32' });
  // `Ignore` always parses in `dot: true` mode, so the option is set before the patterns are added.
  matcher.mmopts.dot = dot;
  for (const pattern of patterns) {
    matcher.add(pattern);
  }
  const cwd = process.cwd();
  return filePath => {
    const fullpath = path.resolve(filePath);
    // Like path-scurry, a file outside the working directory keeps its full path.
    const relative = fullpath.startsWith(cwd + path.sep) ? fullpath.slice(cwd.length + 1) : fullpath;
    return matcher.ignored({ fullpath: () => fullpath, relative: () => relative } as Parameters<Ignore['ignored']>[0]);
  };
}

function toArray(patterns: string | string[]): string[] {
  return Array.isArray(patterns) ? patterns : [patterns];
}
