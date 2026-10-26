import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideCalendar,
  withDateAdapter,
} from '@ascentsparksoftware/angular-calendar';
import { provideDateFnsAdapter } from '@ascentsparksoftware/angular-calendar/date-fns';
import { Playground } from './playground';

describe('Playground month navigation', () => {
  let fixture: ComponentFixture<Playground>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Playground],
      providers: [provideCalendar(withDateAdapter(provideDateFnsAdapter()))],
    }).compileComponents();

    fixture = TestBed.createComponent(Playground);
    fixture.detectChanges();
  });

  it('moves one month back and forward from the month view', () => {
    const prev = fixture.nativeElement.querySelector('[data-testid="month-prev"]') as HTMLButtonElement | null;
    const next = fixture.nativeElement.querySelector('[data-testid="month-next"]') as HTMLButtonElement | null;

    expect(prev).toBeTruthy();
    expect(next).toBeTruthy();

    const start = (fixture.componentInstance as any).viewDate();
    prev!.click();
    fixture.detectChanges();

    expect((fixture.componentInstance as any).viewDate().epochMs).toBeLessThan(start.epochMs);
    const prevMonth = (fixture.componentInstance as any).viewDate();

    next!.click();
    fixture.detectChanges();

    expect((fixture.componentInstance as any).viewDate().epochMs).toBe(start.epochMs);
    expect((fixture.componentInstance as any).viewDate().epochMs).toBe(prevMonth.epochMs + 0);
  });
});
