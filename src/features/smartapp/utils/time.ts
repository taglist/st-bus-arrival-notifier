import { SECOND_IN_MS } from '@taglist/constants';
import moment from 'moment';

export function formatTime(seconds: number): string {
  return moment.utc(seconds * SECOND_IN_MS).format('m[분] s[초]');
}

export function getElapsedTime(pastTime: number): number {
  return Math.trunc((Date.now() - pastTime) / SECOND_IN_MS);
}
