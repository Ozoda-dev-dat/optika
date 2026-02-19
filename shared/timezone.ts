/**
 * Timezone utilities for Uzbekistan Optics ERP System
 * Business Timezone: Asia/Tashkent (UTC+5)
 */

export const BUSINESS_TIMEZONE = 'Asia/Tashkent';
export const TIMEZONE_OFFSET = '+05:00';

/**
 * Converts a Date to Asia/Tashkent timezone string
 */
export function toLocalTimezone(date: Date): string {
  return new Date(date.getTime() + (5 * 60 * 60 * 1000)).toISOString().replace('Z', TIMEZONE_OFFSET);
}

/**
 * Converts a UTC date string to local Date object
 */
export function fromUTCString(dateString: string): Date {
  const date = new Date(dateString);
  return new Date(date.getTime() - (5 * 60 * 60 * 1000));
}

/**
 * Gets current date in business timezone at start of day
 */
export function getLocalStartOfDay(date: Date = new Date()): Date {
  const localDate = new Date(date.getTime() + (5 * 60 * 60 * 1000));
  localDate.setHours(0, 0, 0, 0);
  return new Date(localDate.getTime() - (5 * 60 * 60 * 1000));
}

/**
 * Gets current date in business timezone at end of day
 */
export function getLocalEndOfDay(date: Date = new Date()): Date {
  const localDate = new Date(date.getTime() + (5 * 60 * 60 * 1000));
  localDate.setHours(23, 59, 59, 999);
  return new Date(localDate.getTime() - (5 * 60 * 60 * 1000));
}

/**
 * Formats date for display in local timezone
 */
export function formatLocalDate(date: Date): string {
  const localDate = new Date(date.getTime() + (5 * 60 * 60 * 1000));
  return localDate.toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE
  });
}

/**
 * Gets current timestamp in business timezone
 */
export function getCurrentTimestamp(): string {
  return toLocalTimezone(new Date());
}
