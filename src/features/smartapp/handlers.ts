import type { SmartAppContext } from '@smartthings/smartapp';
import { MINUTE_IN_SECONDS, STATUS_CODES } from '@taglist/constants';
import * as errors from '@taglist/errors';

import { BUSES, COMMONS, MESSAGES, SCHEDULES } from '@/config';
import { BusService } from '@/features/buses';
import db from '@/lib/db';

import * as app from './helpers/app';
import * as time from './utils/time';

export async function handleOn(ctx: SmartAppContext): Promise<void> {
  const { cityNumber, stopCode, routeCodes } = app.getConfig(ctx);
  const arrivalInfo = await retrieveArrivalInfo(cityNumber, stopCode, routeCodes);

  if (typeof arrivalInfo === 'string') {
    return app.sendError(ctx, arrivalInfo);
  }

  const deviceId = app.getDeviceId(ctx);
  const preferences = await app.getPreferences(ctx, deviceId);
  const arrivalTimes = app.initializeStates(deviceId, arrivalInfo, preferences);

  await Promise.all([
    app.sendTimes(ctx, ...arrivalTimes),
    ctx.api.schedules.schedule(SCHEDULES.update, `0/1 * * * ? *`, 'UTC'),
  ]);

  return undefined;
}

async function retrieveArrivalInfo(cityNumber: number, stopCode: string, routeCodes: string[]) {
  let arrivalInfo = {} as Types.StopArrivalInfo;

  try {
    arrivalInfo = await BusService.retrieveArrivalInfo(cityNumber, stopCode);
  } catch (err) {
    const statusCode = err instanceof errors.Error ? err.code : STATUS_CODES.badRequest;

    return toErrorMessage(statusCode);
  }

  const buses = arrivalInfo.buses
    ?.filter(info => routeCodes.includes(info.code))
    .sort((a, b) => a.arrivalTime - b.arrivalTime);

  if (!buses || !buses.length) {
    return MESSAGES.noBus;
  }

  return {
    buses,
    stop: arrivalInfo.stop,
  };
}

function toErrorMessage(statusCode: number) {
  switch (statusCode) {
    case STATUS_CODES.unauthorized:
      return MESSAGES.unauthorized;
    case STATUS_CODES.forbidden:
      return MESSAGES.forbidden;
    case STATUS_CODES.serviceUnavailable:
      return MESSAGES.serviceUnavailable;
    default:
      return MESSAGES.error;
  }
}

export async function handleOff(ctx: SmartAppContext): Promise<void> {
  await ctx.api.schedules.delete();
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function handleUpdate(ctx: SmartAppContext): Promise<void> {
  const deviceId = app.getDeviceId(ctx);
  const { firstDisplayedTime, secondDisplayedTime, lastUpdatedTime } = app.getAttributes(deviceId);

  if (!lastUpdatedTime) {
    return app.sendError(ctx, MESSAGES.error);
  }

  const { cityNumber, stopCode, routeCodes } = app.getConfig(ctx);
  const arrivalInfo = await retrieveArrivalInfo(cityNumber, stopCode, routeCodes);

  if (typeof arrivalInfo === 'string') {
    return app.sendError(ctx, arrivalInfo, false);
  }

  const routeNumberRequired = app.hasRouteNumber(deviceId);

  if (routeNumberRequired) {
    app.saveRouteNumbers(deviceId, arrivalInfo.buses);
  }

  const firstArrivalTime = arrivalInfo.buses[0].arrivalTime;
  const secondArrivalTime = arrivalInfo.buses[1]?.arrivalTime ?? COMMONS.noBus;

  const key = `${deviceId}.arrivalTimes`;
  const [firstSavedTime, secondSavedTime] = db.get(key).value();
  const arrivalInfoUpdated =
    firstArrivalTime !== firstSavedTime || secondArrivalTime !== secondSavedTime;

  const elapsedTime = time.getElapsedTime(lastUpdatedTime);
  const thresholdTime = BUSES.thresholdTime - MINUTE_IN_SECONDS;
  const possibleArrivalTime = 3 * MINUTE_IN_SECONDS;

  // Run if the first bus has already arrived.
  if (firstDisplayedTime === COMMONS.arrival) {
    if (secondDisplayedTime < 1) {
      return app.sendError(ctx, MESSAGES.busAlreadyArrived);
    }
    if (!arrivalInfoUpdated) {
      const remainingTime = secondDisplayedTime - elapsedTime;

      if (remainingTime < 1) {
        return app.sendError(ctx, MESSAGES.busArrived);
      }

      return app.sendTimes(ctx, COMMONS.arrival, remainingTime);
    }
    if (firstArrivalTime - secondDisplayedTime >= thresholdTime) {
      const error = secondDisplayedTime < possibleArrivalTime ? 'busAlreadyArrived' : 'busMissing';

      return app.sendError(ctx, MESSAGES[error]);
    }

    db.set(key, [firstArrivalTime, secondArrivalTime]).write();

    return app.sendTimes(ctx, COMMONS.arrival, firstArrivalTime);
  }
  // Run if the first bus has not arrived.
  if (secondDisplayedTime === COMMONS.noBus) {
    if (!arrivalInfoUpdated) {
      const remainingTime = firstDisplayedTime - elapsedTime;

      if (remainingTime < 1) {
        return app.sendError(ctx, MESSAGES.busArrived);
      }

      return app.sendTimes(ctx, remainingTime, secondArrivalTime);
    }
    if (firstArrivalTime - firstDisplayedTime >= thresholdTime) {
      const error = firstDisplayedTime < possibleArrivalTime ? 'busAlreadyArrived' : 'busMissing';

      return app.sendError(ctx, MESSAGES[error]);
    }

    db.set(key, [firstArrivalTime, secondArrivalTime]).write();

    return app.sendTimes(ctx, firstArrivalTime, secondArrivalTime);
  }
  // Run if neither the first nor the second bus has arrived.
  if (secondDisplayedTime > COMMONS.arrival) {
    if (!arrivalInfoUpdated) {
      const firstRemainingTime = firstDisplayedTime - elapsedTime;
      const secondRemainingTime = secondDisplayedTime - elapsedTime;

      if (firstRemainingTime < 1) {
        if (secondRemainingTime < 1) {
          return app.sendError(ctx, MESSAGES.busArrived);
        }
        if (routeNumberRequired) {
          const newArrivalInfo = [{ ...arrivalInfo.buses[0], name: '' }, arrivalInfo.buses[1]];

          app.saveRouteNumbers(deviceId, newArrivalInfo);
        }

        return app.sendTimes(ctx, COMMONS.arrival, secondRemainingTime);
      }

      return app.sendTimes(ctx, firstRemainingTime, secondRemainingTime);
    }

    db.set(key, [firstArrivalTime, secondArrivalTime]).write();

    if (firstArrivalTime - firstDisplayedTime >= thresholdTime) {
      if (firstArrivalTime - secondDisplayedTime >= thresholdTime) {
        const error =
          secondDisplayedTime < possibleArrivalTime ? 'busAlreadyArrived' : 'busMissing';

        return app.sendError(ctx, MESSAGES[error]);
      }

      return app.sendTimes(ctx, COMMONS.arrival, firstArrivalTime);
    }
    // TODO: Add error handling.
    if (firstDisplayedTime < possibleArrivalTime) {
      if (firstArrivalTime < firstDisplayedTime) {
        if (secondArrivalTime - secondDisplayedTime >= thresholdTime) {
          return app.sendTimes(ctx, COMMONS.arrival, firstArrivalTime);
        }
      } else if (firstArrivalTime < secondDisplayedTime) {
        if (
          secondArrivalTime - secondDisplayedTime >= thresholdTime &&
          secondDisplayedTime - firstArrivalTime < thresholdTime + 1 * MINUTE_IN_SECONDS
        ) {
          return app.sendTimes(ctx, COMMONS.arrival, firstArrivalTime);
        }
      } else {
        if (firstArrivalTime - secondDisplayedTime >= thresholdTime) {
          return app.sendError(ctx, MESSAGES.busAlreadyArrived);
        }
        if (
          secondArrivalTime - secondDisplayedTime >= 1 * MINUTE_IN_SECONDS ||
          firstDisplayedTime < 2 * MINUTE_IN_SECONDS
        ) {
          return app.sendTimes(ctx, COMMONS.arrival, firstArrivalTime);
        }
      }
    }

    return app.sendTimes(ctx, firstArrivalTime, secondArrivalTime);
  }

  return app.sendError(ctx, MESSAGES.busMissing);
}
