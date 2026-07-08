import { describe, it, expect } from 'vitest';
import { appendVersion, isVisibleDoc, currentVersion, type VersionMeta } from './doc-versioning';
import type { DocVersionEntry } from '../../interfaces/doc-lifecycle.interface';

const legacyFile = {
  name: 'contrato.pdf',
  storagePath: 'companies/c1/casos/k1/docs/root/111_contrato.pdf',
  downloadUrl: 'https://old-url',
  mimeType: 'application/pdf',
  sizeBytes: 1000,
  uploadedBy: 'user-1',
};

const newMeta: VersionMeta = {
  name: 'contrato-v2.pdf',
  storagePath: 'companies/c1/casos/k1/docs/root/222_contrato-v2.pdf',
  downloadUrl: 'https://new-url',
  mimeType: 'application/pdf',
  sizeBytes: 2000,
  uploadedBy: 'user-2',
  uploadedByNombre: 'Ana',
};

describe('appendVersion', () => {
  it('en un doc legacy sin versions, sintetiza la v1 desde los campos actuales', () => {
    const patch = appendVersion(legacyFile, newMeta);
    expect(patch.version).toBe(2);
    expect(patch.versions).toHaveLength(2);
    expect(patch.versions[0]).toMatchObject({
      version: 1,
      name: 'contrato.pdf',
      storagePath: legacyFile.storagePath,
      uploadedBy: 'user-1',
    });
    expect(patch.versions[1]).toMatchObject({ version: 2, name: 'contrato-v2.pdf' });
  });

  it('los campos top-level del patch apuntan a la versión nueva', () => {
    const patch = appendVersion(legacyFile, newMeta);
    expect(patch.name).toBe('contrato-v2.pdf');
    expect(patch.storagePath).toBe(newMeta.storagePath);
    expect(patch.downloadUrl).toBe('https://new-url');
    expect(patch.sizeBytes).toBe(2000);
    expect(patch.uploadedBy).toBe('user-2');
  });

  it('con historial existente, añade la siguiente versión sin tocar las previas', () => {
    const v2: DocVersionEntry = { ...newMeta, version: 2 };
    const file = { ...legacyFile, version: 2, versions: [{ ...legacyFile, version: 1 } as DocVersionEntry, v2] };
    const patch = appendVersion(file, { ...newMeta, name: 'v3.pdf', storagePath: 'sp3' });
    expect(patch.version).toBe(3);
    expect(patch.versions).toHaveLength(3);
    expect(patch.versions[0].version).toBe(1);
    expect(patch.versions[2]).toMatchObject({ version: 3, name: 'v3.pdf' });
  });

  it('no muta el doc original', () => {
    const file = { ...legacyFile, versions: [{ ...legacyFile, version: 1 } as DocVersionEntry] };
    appendVersion(file, newMeta);
    expect(file.versions).toHaveLength(1);
  });
});

describe('currentVersion', () => {
  it('ausente == 1 (legacy)', () => {
    expect(currentVersion({})).toBe(1);
    expect(currentVersion({ version: 3 })).toBe(3);
  });
});

describe('isVisibleDoc (filtro de soft delete en cliente)', () => {
  it('visible si deleted está ausente (legacy) o es false', () => {
    expect(isVisibleDoc({})).toBe(true);
    expect(isVisibleDoc({ deleted: false })).toBe(true);
  });

  it('oculto si deleted es true', () => {
    expect(isVisibleDoc({ deleted: true })).toBe(false);
  });
});
