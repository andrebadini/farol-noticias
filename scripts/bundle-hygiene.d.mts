import type { Plugin } from 'vite';

export function bundleHygiene(): Plugin;
export function rewriteModule(id: string, code: string): string | null | undefined;
export const BUNDLE_REWRITES: {
  name: string;
  file: RegExp;
  apply(code: string): string | undefined;
}[];
