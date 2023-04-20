import type { SmartAppContext } from '@smartthings/smartapp';
import { MINUTE_IN_SECONDS, STATUS_CODES } from '@taglist/constants';
import * as errors from '@taglist/errors';

import { BUSES, CAPABILITIES, COMMONS, MESSAGES, SCHEDULES } from '@/config';
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

  const deviceId = app.getNotifier(ctx).deviceConfig?.deviceId as string;
  const arrivalTimes = app.saveArrivalInfo(deviceId, arrivalInfo);
  const { notificationInterval } = await app.getPreferences(ctx, deviceId);

  await Promise.all([
    app.sendTimes(ctx, ...arrivalTimes),
    app.sendNotifications(ctx, ...arrivalTimes),
    ctx.api.schedules.schedule(SCHEDULES.update, `0/1 * * * ? *`, 'UTC'),
    ctx.api.schedules.schedule(
      SCHEDULES.notifications,
      `0/${notificationInterval} * * * ? *`,
      'UTC',
    ),
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
  const [notifier] = await ctx.api.devices.list({
    capability: [CAPABILITIES.firstRemainingTime, CAPABILITIES.secondRemainingTime],
    includeStatus: true,
  });

  const attributes = app.getAttributes(notifier);

  if (!attributes) {
    return app.sendError(ctx, MESSAGES.error);
  }

  const { firstRemainingTime, secondRemainingTime } = attributes;
  const firstDisplayedTime = COMMONS[firstRemainingTime] ?? time.toSeconds(firstRemainingTime);
  const secondDisplayedTime = COMMONS[secondRemainingTime] ?? time.toSeconds(secondRemainingTime);

  const { cityNumber, stopCode, routeCodes } = app.getConfig(ctx);
  const arrivalInfo = await retrieveArrivalInfo(cityNumber, stopCode, routeCodes);

  if (typeof arrivalInfo === 'string') {
    return app.sendError(ctx, arrivalInfo, false);
  }

  const firstArrivalTime = arrivalInfo.buses[0].arrivalTime;
  const secondArrivalTime = arrivalInfo.buses[1]?.arrivalTime ?? COMMONS.noBus;
  const lastUpdatedTime = time.extractUpdatedTime(attributes.statusMessage);

  if (!lastUpdatedTime) {
    return app.sendError(ctx, MESSAGES.error);
  }
  if (firstDisplayedTime < COMMONS.arrival) {
    return app.sendError(ctx, MESSAGES.busAlreadyArrived);
  }

  const key = `${notifier.deviceId}.arrivalInfo`;
  const [firstSavedTime, secondSavedTime] = db.get(key).value();
  const arrivalInfoUpdated =
    firstSavedTime !== firstArrivalTime || secondSavedTime !== secondArrivalTime;

  const elapsedTime = time.getElapsedTime(lastUpdatedTime);
  const thresholdTime = BUSES.thresholdTime - 1 * MINUTE_IN_SECONDS;
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
      const remainingFirstTime = firstDisplayedTime - elapsedTime;
      const remainingSecondTime = secondDisplayedTime - elapsedTime;

      if (remainingFirstTime < 1) {
        if (remainingSecondTime < 1) {
          return app.sendError(ctx, MESSAGES.busArrived);
        }

        return app.sendTimes(ctx, COMMONS.arrival, remainingSecondTime);
      }

      return app.sendTimes(ctx, remainingFirstTime, remainingSecondTime);
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
          secondDisplayedTime - firstArrivalTime < thresholdTime
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

export async function handleNotifications(ctx: SmartAppContext): Promise<void> {
  const [notifier] = await ctx.api.devices.list({
    capability: [CAPABILITIES.firstRemainingTime, CAPABILITIES.secondRemainingTime],
    includeStatus: true,
  });

  const attributes = app.getAttributes(notifier);

  if (!attributes) {
    return app.sendError(ctx, MESSAGES.error);
  }

  const { firstRemainingTime, secondRemainingTime } = attributes;
  const displayedFirstTime = COMMONS[firstRemainingTime] ?? time.toSeconds(firstRemainingTime);
  const displayedSecondTime = COMMONS[secondRemainingTime] ?? time.toSeconds(secondRemainingTime);

  return app.sendNotifications(ctx, displayedFirstTime, displayedSecondTime);
}
