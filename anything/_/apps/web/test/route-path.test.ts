import { describe, expect, it } from 'vitest';
import { getHonoPath } from '../__create/route-path';

describe('bundled API route paths', () => {
  it('supports nested and Windows separator paths', () => {
    expect(getHonoPath('../src/app/api/user/profile/route.js')).toBe('/user/profile');
    expect(getHonoPath('..\\src\\app\\api\\user\\profile\\route.js')).toBe('/user/profile');
  });
  it('supports root, parameters and catch-all routes', () => {
    expect(getHonoPath('../src/app/api/route.js')).toBe('/');
    expect(getHonoPath('../src/app/api/investigations/[id]/route.js')).toBe('/investigations/:id');
    expect(getHonoPath('../src/app/api/files/[...path]/route.ts')).toBe('/files/:path{.+}');
  });
  it('rejects paths outside the route module registry', () => {
    expect(() => getHonoPath('build/server/api.js')).toThrow('Invalid API route');
  });
});
