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

export const tago = axios.create(CLIENTS.tago);

tago.interceptors.response.use(
  res => {
    if (typeof res.data !== 'object') {
      return Promise.reject(res);
    }

    const resultCode = res.data.response?.header?.resultCode;

    if (resultCode === '00') {
      return Promise.resolve(res);
    }
    if (resultCode === '20' || resultCode === '99') {
      const error = new errors.Forbidden('Service access denied');

      return Promise.reject(error);
    }

    return Promise.reject(res);
  },
  err => {
    console.error(err);

    if (axios.isAxiosError(err)) {
      const error = new errors.ServiceUnavailable('Tago');

      return Promise.reject(error);
    }

    return Promise.reject(err);
  },
);

export const seoulBus = axios.create(CLIENTS.seoulBus);

seoulBus.interceptors.response.use(
  res => {
    if (typeof res.data !== 'object') {
      return Promise.reject(res);
    }

    const resultCode = res.data.msgHeader?.headerCd;

    if (resultCode === '0') {
      return Promise.resolve(res);
    }
    if (resultCode === '7') {
      const error = new errors.Unauthorized('Service key not registered');

      return Promise.reject(error);
    }
    if (resultCode === '8') {
      const error = new errors.RequestLimitExceeded('Daily');

      return Promise.reject(error);
    }

    return Promise.reject(res);
  },
  err => {
    console.error(err);

    if (axios.isAxiosError(err)) {
      return Promise.reject(new errors.ServiceUnavailable('Seoul bus'));
    }

    return Promise.reject(err);
  },
);
