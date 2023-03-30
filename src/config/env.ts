import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';

const result = dotenv.config();

if (result.error) {
  throw result.error;
}

export const NODE_ENV = process.env.NODE_ENV || 'development';

const envPath = path.resolve(process.cwd(), `.env.${NODE_ENV}`);
const envConfig = dotenv.parse(fs.readFileSync(envPath));

Object.assign(process.env, envConfig);

export const APP = {
  port: +process.env.APP_PORT || 3000,
} as const;

export const PROVIDERS = {
  tago: {
    url: process.env.OPEN_API_URL,
    key: process.env.OPEN_API_KEY,
  },
} as const;
