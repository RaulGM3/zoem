import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Functions } from '@angular/fire/functions';
import { CalendarFeedService } from './calendar-feed.service';

const { mockCallable, mockHttpsCallable } = vi.hoisted(() => {
  const mockCallable = vi.fn();
  return { mockCallable, mockHttpsCallable: vi.fn().mockReturnValue(mockCallable) };
});

vi.mock('@angular/fire/functions', () => ({
  Functions: class MockFunctions {},
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

describe('CalendarFeedService', () => {
  let service: CalendarFeedService;

  beforeEach(() => {
    mockCallable.mockReset();
    mockHttpsCallable.mockClear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [CalendarFeedService, { provide: Functions, useValue: {} }],
    });
    service = TestBed.inject(CalendarFeedService);
  });

  it('createToken llama a la callable createCalendarFeedToken con companyId y devuelve las URLs', async () => {
    mockCallable.mockResolvedValue({
      data: { feedUrl: 'https://x/calendarFeed?t=abc', webcalUrl: 'webcal://x/calendarFeed?t=abc' },
    });

    const result = await service.createToken('company-1');

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'createCalendarFeedToken');
    expect(mockCallable).toHaveBeenCalledWith({ companyId: 'company-1' });
    expect(result).toEqual({
      feedUrl: 'https://x/calendarFeed?t=abc',
      webcalUrl: 'webcal://x/calendarFeed?t=abc',
    });
  });

  it('revokeToken llama a la callable revokeCalendarFeedToken con companyId', async () => {
    mockCallable.mockResolvedValue({ data: { revoked: 1 } });

    const result = await service.revokeToken('company-1');

    expect(mockHttpsCallable).toHaveBeenCalledWith(expect.anything(), 'revokeCalendarFeedToken');
    expect(mockCallable).toHaveBeenCalledWith({ companyId: 'company-1' });
    expect(result).toEqual({ revoked: 1 });
  });
});
