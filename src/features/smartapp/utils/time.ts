import { SECOND_IN_MS } from '@taglist/constants';
import moment from 'moment';

export function formatTime(seconds: number): string {
  return moment.utc(seconds * SECOND_IN_MS).format('m[분] s[초]');
}

const timeFormat = /(?<minutes>\d+(?=분))?\D*(?<seconds>\d+(?=초))/;

export function toSeconds(time: string): number {
  const matches = timeFormat.exec(time);
  const minutes = matches?.groups?.minutes ?? 0;
  const seconds = matches?.groups?.seconds ?? 0;

  return +minutes * 60 + +seconds;
}

const statusFormat = /\d{2}:\d{2}:\d{2}/;

export function extractUpdatedTime(status: string): moment.Moment | null {
  const match = status.match(statusFormat);

  return match && moment.utc(match[0], 'HH:mm:ss').subtract(9, 'hours');
}

export function getElapsedTime(pastTime: moment.Moment): number {
  return Math.trunc(moment.utc().diff(pastTime) / SECOND_IN_MS);
}
