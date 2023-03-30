import { PROVIDERS } from './env';

export default {
  tago: {
    baseURL: PROVIDERS.tago.url,
    params: {
      _type: 'json',
      serviceKey: PROVIDERS.tago.key,
    },
  },
};
