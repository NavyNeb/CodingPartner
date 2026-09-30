import { transform, type Transform } from 'sucrase';
import type { Lang } from '../content/types';

/** Strip types / JSX and convert ESM → CJS so the harness can `new Function` it. */
export function compile(code: string, lang: Lang): string {
  const transforms: Transform[] =
    lang === 'js' ? ['jsx', 'imports'] : lang === 'ts' ? ['typescript', 'imports'] : ['typescript', 'jsx', 'imports'];
  return transform(code, {
    transforms,
    jsxRuntime: 'automatic',
    production: true,
    disableESTransforms: true,
    filePath: lang === 'js' ? 'file.js' : lang === 'ts' ? 'file.ts' : 'file.tsx',
  }).code;
}
