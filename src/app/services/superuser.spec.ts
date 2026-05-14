import { TestBed } from '@angular/core/testing';

import { Superuser } from './superuser';

describe('Superuser', () => {
  let service: Superuser;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Superuser);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
