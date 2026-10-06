import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Auth } from '@angular/fire/auth';
import { Functions } from '@angular/fire/functions';
import { ClaimsSyncService } from './claims-sync.service';

const { httpsCallableMock } = vi.hoisted(() => ({ httpsCallableMock: vi.fn() }));

vi.mock('@angular/fire/auth', () => ({ Auth: class MockAuth {} }));
vi.mock('@angular/fire/functions', () => ({
  Functions: class MockFunctions {},
  httpsCallable: (...args: unknown[]) => httpsCallableMock(...args),
}));

describe('ClaimsSyncService', () => {
  let getIdToken: ReturnType<typeof vi.fn>;
  let auth: { currentUser: { getIdToken: ReturnType<typeof vi.fn> } | null };

  beforeEach(() => {
    httpsCallableMock.mockReset();
    getIdToken = vi.fn().mockResolvedValue('t');
    auth = { currentUser: { getIdToken } };
    TestBed.configureTestingModule({
      providers: [
        { provide: Auth, useValue: auth },
        { provide: Functions, useValue: {} },
      ],
    });
  });

  it('llama a syncMyClaims con la empresa y fuerza refresh del token si cambiaron', async () => {
    const fn = vi.fn().mockResolvedValue({ data: { changed: true } });
    httpsCallableMock.mockReturnValue(fn);

    await TestBed.inject(ClaimsSyncService).sync('c1');

    expect(httpsCallableMock).toHaveBeenCalledWith(expect.anything(), 'syncMyClaims');
    expect(fn).toHaveBeenCalledWith({ companyId: 'c1' });
    expect(getIdToken).toHaveBeenCalledWith(true);
  });

  it('no refresca el token si los claims ya estaban bien', async () => {
    httpsCallableMock.mockReturnValue(vi.fn().mockResolvedValue({ data: { changed: false } }));

    await TestBed.inject(ClaimsSyncService).sync('c1');

    expect(getIdToken).not.toHaveBeenCalled();
  });

  it('no lanza si la callable falla', async () => {
    httpsCallableMock.mockReturnValue(vi.fn().mockRejectedValue(new Error('boom')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(TestBed.inject(ClaimsSyncService).sync('c1')).resolves.toBeUndefined();
    expect(getIdToken).not.toHaveBeenCalled();
  });

  it('sin usuario no hace nada', async () => {
    auth.currentUser = null;

    await TestBed.inject(ClaimsSyncService).sync('c1');

    expect(httpsCallableMock).not.toHaveBeenCalled();
  });
});
