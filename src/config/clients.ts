import { SECOND_IN_MS } from '@taglist/constants';

import { PROVIDERS } from './env';

export default {
  tago: {
    baseURL: 'https://apis.data.go.kr/1613000',
    params: {
      _type: 'json',
      serviceKey: PROVIDERS.tago.key,
    },
    timeout: 7 * SECOND_IN_MS,
  },
};
