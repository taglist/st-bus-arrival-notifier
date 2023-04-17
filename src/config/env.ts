import fs from 'fs';
import path from 'path';

import { MINUTE_IN_SECONDS } from '@taglist/constants';
import dotenv from 'dotenv';

const result = dotenv.config();

if (result.error) {
  throw result.error;
}

export const NODE_ENV = process.env.NODE_ENV || 'development';

const envPath = path.resolve(process.cwd(), `.env.${NODE_ENV}`);

try {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));

  Object.assign(process.env, envConfig);
} catch {}

export const APP = {
  port: +(process.env.APP_PORT ?? 3000),
} as const;

export const PROVIDERS = {
  tago: {
    key: process.env.OPEN_API_KEY,
  },
} as const;

export const BUSES = {
  minTime: +(process.env.BUS_MIN_TIME ?? 5) * MINUTE_IN_SECONDS,
} as const;
