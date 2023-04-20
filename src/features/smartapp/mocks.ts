import type * as st from '@smartthings/core-sdk';
import type { SmartAppContext } from '@smartthings/smartapp';

export const deviceId = 'notifier';

export const notifier = {
  deviceId,
} as st.Device;

export const ctx = {
  api: {
    devices: {
      list: () => Promise.resolve([notifier]),
    },
  },
} as SmartAppContext;

export const cityNumber = 100;

export const code = 'foo';

export const config = {
  cityNumber,
  stopCode: code,
  routeCodes: [code],
};

export const elapsedTime = 60;

export const name = 'test';

export const stop = {
  code,
  name,
};

export const routeType = '일반' as Types.BusRouteType;

export const vehicleType = '일반버스' as Types.BusVehicleType;

export const baseArrivalInfo = {
  code,
  name,
  vehicleType,
  type: routeType,
  remainingStopCount: 10,
};
