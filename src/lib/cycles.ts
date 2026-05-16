export interface CycleSettings {
  cutoffWeekday: number;
  cutoffTime: string;
  acquisitionDays: number;
  monetizationDays: number;
}

export interface LaunchCycle {
  id: string;
  label: string;
  start: string;
  workshopEnd: string;
  edenEnd: string;
}

export const defaultCycleSettings: CycleSettings = {
  cutoffWeekday: 6,
  cutoffTime: '09:00',
  acquisitionDays: 7,
  monetizationDays: 7,
};

const dayMs = 24 * 60 * 60 * 1000;

export function getCurrentOperationCycle(settings: CycleSettings = defaultCycleSettings, now = new Date()) {
  const workshopStart = getCycleStartForDate(now, settings);
  const edenStart = addDays(workshopStart, -settings.acquisitionDays);
  return {
    workshop: makeCycle(workshopStart, settings),
    eden: makeCycle(edenStart, settings),
  };
}

export function getRecentCycles(settings: CycleSettings = defaultCycleSettings, count = 10, now = new Date()) {
  const currentStart = getCycleStartForDate(now, settings);
  return Array.from({ length: count }, (_, index) => makeCycle(addDays(currentStart, -index * settings.acquisitionDays), settings));
}

export function makeCycle(start: Date, settings: CycleSettings = defaultCycleSettings): LaunchCycle {
  const normalized = applyCutoffTime(start, settings.cutoffTime);
  const workshopEnd = addDays(normalized, settings.acquisitionDays);
  const edenEnd = addDays(workshopEnd, settings.monetizationDays);
  return {
    id: toIso(normalized),
    label: `Ciclo ${formatShortDate(toIso(normalized))}`,
    start: toIso(normalized),
    workshopEnd: toIso(workshopEnd),
    edenEnd: toIso(edenEnd),
  };
}

export function isInWorkshopWindow(date: string, cycle: LaunchCycle, settings: CycleSettings = defaultCycleSettings, occurredAt?: string) {
  return isInWindow(resolveMoment(date, occurredAt, settings), toWindowStart(cycle.start, settings), toWindowStart(cycle.workshopEnd, settings));
}

export function isInEdenWindow(date: string, cycle: LaunchCycle, settings: CycleSettings = defaultCycleSettings, occurredAt?: string) {
  return isInWindow(resolveMoment(date, occurredAt, settings), toWindowStart(cycle.workshopEnd, settings), toWindowStart(cycle.edenEnd, settings));
}

export function describeCycle(cycle: LaunchCycle) {
  return `${formatShortDate(cycle.start)} -> ${formatShortDate(cycle.edenEnd)}`;
}

export function getCycleLabel(cycle: LaunchCycle) {
  return `Ciclo ${formatShortDate(cycle.start)} a ${formatShortDate(cycle.edenEnd)}`;
}

export function describeCycleWindows(cycle: LaunchCycle) {
  return {
    workshop: `${formatShortDate(cycle.start)} -> ${formatShortDate(cycle.workshopEnd)}`,
    eden: `${formatShortDate(cycle.workshopEnd)} -> ${formatShortDate(cycle.edenEnd)}`,
  };
}

export function getCycleStartForDate(date: Date, settings: CycleSettings = defaultCycleSettings) {
  const cutoff = applyCutoffTime(startOfDay(date), settings.cutoffTime);
  const diff = (cutoff.getDay() - settings.cutoffWeekday + 7) % 7;
  cutoff.setDate(cutoff.getDate() - diff);
  if (date.getTime() < cutoff.getTime()) cutoff.setDate(cutoff.getDate() - 7);
  return cutoff;
}

export function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`));
}

function resolveMoment(date: string, occurredAt: string | undefined, settings: CycleSettings) {
  if (occurredAt) return new Date(occurredAt);
  return new Date(`${date}T00:00:00`);
}

function toWindowStart(date: string, settings: CycleSettings) {
  return applyCutoffTime(new Date(`${date}T00:00:00`), settings.cutoffTime);
}

function isInWindow(moment: Date, start: Date, end: Date) {
  return moment.getTime() >= start.getTime() && moment.getTime() < end.getTime();
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * dayMs);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function applyCutoffTime(date: Date, time: string) {
  const [hour = '0', minute = '0'] = time.split(':');
  const next = new Date(date);
  next.setHours(Number(hour) || 0, Number(minute) || 0, 0, 0);
  return next;
}
