export interface PollSchedule {
  startHour: number;
  endHour: number;
  timeZone: string;
}

function hourInTimeZone(now: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  return Number(hour);
}

export function isPollingActive(now: Date, schedule: PollSchedule): boolean {
  const hour = hourInTimeZone(now, schedule.timeZone);

  if (schedule.startHour === schedule.endHour) return true;
  if (schedule.startHour < schedule.endHour) {
    return hour >= schedule.startHour && hour < schedule.endHour;
  }

  return hour >= schedule.startHour || hour < schedule.endHour;
}
