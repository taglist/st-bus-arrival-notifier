/* eslint-disable no-console */
import * as errors from '@taglist/errors';
import axios from 'axios';

import { CLIENTS } from '@/config';

axios.interceptors.response.use(
  res => res,
  err => {
    console.error(err);

    return Promise.reject(err);
  },
);

// eslint-disable-next-line import/prefer-default-export
export const tago = axios.create(CLIENTS.tago);

tago.interceptors.response.use(
  res => {
    return typeof res.data === 'object' ? Promise.resolve(res) : Promise.reject(res);
  },
  err => {
    console.error(err);

    if (axios.isAxiosError(err)) {
      return Promise.reject(new errors.ServiceUnavailable('Tago'));
    }

    return Promise.reject(err);
  },
);
