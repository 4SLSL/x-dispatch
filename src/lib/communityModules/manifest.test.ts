import { describe, expect, it } from 'vitest';
import { checkMinAppVersion, readAndValidateManifest } from './manifest';
import { moduleManifestSchema } from './types';

describe('moduleManifestSchema', () => {
  it('accepts a minimal valid manifest', () => {
    const result = moduleManifestSchema.safeParse({
      id: 'com.example.hello',
      name: 'Hello',
      version: '1.0.0',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid id', () => {
    const result = moduleManifestSchema.safeParse({
      id: '..bad',
      name: 'Hello',
      version: '1.0.0',
    });
    expect(result.success).toBe(false);
  });
});

describe('checkMinAppVersion', () => {
  it('passes when app meets minimum', () => {
    const result = checkMinAppVersion(
      { id: 'com.example.a', name: 'A', version: '1.0.0', minAppVersion: '1.9.0' },
      '1.9.1'
    );
    expect(result.ok).toBe(true);
  });

  it('fails when app is too old', () => {
    const result = checkMinAppVersion(
      { id: 'com.example.a', name: 'A', version: '1.0.0', minAppVersion: '2.0.0' },
      '1.9.1'
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('MIN_APP_VERSION');
  });
});

describe('readAndValidateManifest', () => {
  it('returns error for missing file', () => {
    const result = readAndValidateManifest('/nonexistent/x-dispatch-module.json');
    expect(result.ok).toBe(false);
  });
});
