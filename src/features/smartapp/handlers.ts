import type * as st from '@smartthings/core-sdk';
import { SmartAppContext } from '@smartthings/smartapp';
import { MINUTE_IN_SECONDS, SECOND_IN_MS, STATUS_CODES } from '@taglist/constants';
import * as errors from '@taglist/errors';
import type { Dictionary } from '@taglist/types';
import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import moment from 'moment';
import { object } from 'ryutils';

import { BUSES, CAPABILITIES, MESSAGES, SCHEDULES } from '@/config';
import { BusService } from '@/features/buses';

const adapter = new FileSync('db.json');
const db = low(adapter);

const arrivalText = '도착';
const noneText = '없음';
const blankText = '-';
const busCodes = {
  [arrivalText]: 0,
  noBus: -1,
  [noneText]: -1,
  blank: -999,
  [blankText]: -999,
} as const;

const stopNames = {} as Dictionary;

export async function handleOn(ctx: SmartAppContext): Promise<void> {
  const { cityNumber, stopCode, routeCodes } = getConfig(ctx);
  const arrivalInfo = await retrieveArrivalInfo(cityNumber, stopCode, routeCodes);

  if (typeof arrivalInfo === 'string') {
    return sendError(ctx, arrivalInfo);
  }

  const firstArrivalTime = arrivalInfo.buses[0].arrivalTime;
  const secondArrivalTime = arrivalInfo.buses[1]?.arrivalTime ?? busCodes.noBus;
  const arrivalTimes = [firstArrivalTime, secondArrivalTime] as const;
  const deviceId = getNotifier(ctx).deviceConfig?.deviceId as string;

  db.set(`${deviceId}.arrivalInfo`, arrivalTimes).value();
  db.set(`${deviceId}.errorCount`, 0).value();
  db.write();
  stopNames[deviceId] = arrivalInfo.stop.name;

  await Promise.all([
    sendTimes(ctx, ...arrivalTimes),
    sendNotifications(ctx, ...arrivalTimes),
    ctx.api.schedules.schedule(SCHEDULES.update, `0/1 * * * ? *`, 'UTC'),
  ]);

  const { notificationInterval } = await getPreferences(ctx, deviceId);

  await ctx.api.schedules.schedule(
    SCHEDULES.notifications,
    `0/${notificationInterval} * * * ? *`,
    'UTC',
  );

  return undefined;
}

function getConfig(ctx: SmartAppContext) {
  return {
    cityNumber: ctx.configNumberValue('cityNumber'),
    stopCode: ctx.configStringValue('stopCode'),
    routeCodes: ctx.configStringValue('routeCodes').split(','),
  };
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

async function sendError(ctx: SmartAppContext, message: string, forced = true) {
  if (!forced) {
    const key = `${getNotifier(ctx).deviceConfig?.deviceId}.errorCount`;
    const errorCount = db.get(key).value();

    if (!errorCount) {
      return db.set(key, errorCount + 1).write();
    }
  }

  await Promise.all([sendSwitchOff(ctx), sendAlerts(ctx, message)]);

  return undefined;
}

export function getNotifier(ctx: SmartAppContext): st.ConfigEntry {
  return ctx.config.notifier[0];
}

async function sendSwitchOff(ctx: SmartAppContext) {
  await ctx.api.devices.sendCommand(getNotifier(ctx), [toSwitchOffCommand()]);
}

function toSwitchOffCommand() {
  return {
    capability: 'switch',
    command: 'off',
  };
}

async function sendAlerts(ctx: SmartAppContext, message: string) {
  await Promise.all([sendMessage(ctx, message), sendSpeech(ctx, message)]);
}

async function sendMessage(ctx: SmartAppContext, message: string) {
  await ctx.api.devices.sendCommand(getNotifier(ctx), [toMessageCommand(message)], '');
}

function toMessageCommand(message: string) {
  return {
    capability: CAPABILITIES.statusMessage,
    command: 'setMessage',
    arguments: [message],
  };
}

async function sendSpeech(ctx: SmartAppContext, phrase: string) {
  if (ctx.config.speakers) {
    await ctx.api.devices.sendCommands(ctx.config.speakers, [toSpeakCommand(phrase)], '');
  }
}

function toSpeakCommand(phrase: string) {
  return {
    capability: CAPABILITIES.speechSynthesis,
    command: 'speak',
    arguments: [phrase],
  };
}

async function getPreferences(ctx: SmartAppContext, deviceId: string) {
  const preferences = await extractPreferences(ctx, deviceId);

  return {
    notificationInterval: preferences.notificationInterval.value || 3,
  };
}

async function extractPreferences(ctx: SmartAppContext, deviceId: string) {
  const preferences = await ctx.api.devices.getPreferences(deviceId);

  return preferences.values as Types.Preferences;
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

  const attributes = getAttributes(notifier);

  if (!attributes) {
    return sendError(ctx, MESSAGES.error);
  }

  const { firstRemainingTime, secondRemainingTime } = attributes;
  const displayedFirstTime = busCodes[firstRemainingTime] ?? toSeconds(firstRemainingTime);
  const displayedSecondTime = busCodes[secondRemainingTime] ?? toSeconds(secondRemainingTime);

  const { cityNumber, stopCode, routeCodes } = getConfig(ctx);
  const arrivalInfo = await retrieveArrivalInfo(cityNumber, stopCode, routeCodes);

  if (typeof arrivalInfo === 'string') {
    return sendError(ctx, arrivalInfo, false);
  }

  const firstArrivalTime = arrivalInfo.buses[0].arrivalTime;
  const secondArrivalTime = arrivalInfo.buses[1]?.arrivalTime ?? busCodes.noBus;
  const lastUpdatedTime = extractUpdatedTime(attributes.statusMessage);

  if (!lastUpdatedTime) {
    return sendError(ctx, MESSAGES.error);
  }

  const key = `${notifier.deviceId}.arrivalInfo`;
  const [savedFirstTime, savedSecondTime] = db.get(key).value();
  const arrivalInfoUpdated = firstArrivalTime !== savedFirstTime;
  const elapsedTime = getElapsedTime(lastUpdatedTime);

  if (
    arrivalInfoUpdated &&
    displayedFirstTime &&
    firstArrivalTime - displayedFirstTime < 4 * MINUTE_IN_SECONDS
  ) {
    db.set(key, [firstArrivalTime, secondArrivalTime]).write();

    return sendTimes(ctx, firstArrivalTime, secondArrivalTime);
  }
  if (displayedSecondTime === busCodes.noBus) {
    if (!arrivalInfoUpdated) {
      const remainingTime = displayedFirstTime - elapsedTime;

      if (remainingTime < 1) {
        return sendError(ctx, MESSAGES.busArrived);
      }

      return sendTimes(ctx, remainingTime, secondArrivalTime);
    }
    if (displayedFirstTime < 3 * MINUTE_IN_SECONDS) {
      return sendError(ctx, MESSAGES.busAlreadyArrived);
    }

    return sendError(ctx, MESSAGES.missedBus);
  }
  if (displayedFirstTime !== busCodes[arrivalText]) {
    if (!arrivalInfoUpdated) {
      const remainingFirstTime = displayedFirstTime - elapsedTime;
      const remainingSecondTime = displayedSecondTime - elapsedTime;

      if (remainingFirstTime < 1) {
        if (remainingSecondTime < 1) {
          return sendError(ctx, MESSAGES.busArrived);
        }

        return sendTimes(ctx, busCodes[arrivalText], remainingSecondTime);
      }

      return sendTimes(ctx, remainingFirstTime, remainingSecondTime);
    }
    if (displayedFirstTime < 3 * MINUTE_IN_SECONDS) {
      const arrivalTimes = [busCodes[arrivalText], firstArrivalTime] as const;

      db.set(key, arrivalTimes).write();

      return sendTimes(ctx, ...arrivalTimes);
    }

    return sendError(ctx, MESSAGES.missedBus);
  }

  // Run if the first bus has already arrived.
  const newFirstTime = busCodes[arrivalText];
  const secondTimeUpdated = firstArrivalTime !== savedSecondTime;

  if (secondTimeUpdated && firstArrivalTime - displayedSecondTime < 4 * MINUTE_IN_SECONDS) {
    const arrivalTimes = [newFirstTime, firstArrivalTime] as const;

    db.set(key, arrivalTimes).write();

    return sendTimes(ctx, ...arrivalTimes);
  }
  if (!secondTimeUpdated) {
    const remainingTime = displayedSecondTime - elapsedTime;

    if (remainingTime < 1) {
      return sendError(ctx, MESSAGES.busArrived);
    }

    return sendTimes(ctx, newFirstTime, remainingTime);
  }
  if (displayedSecondTime < 3 * MINUTE_IN_SECONDS) {
    return sendError(ctx, MESSAGES.busAlreadyArrived);
  }

  return sendError(ctx, MESSAGES.missedBus);
}

function getAttributes(device: st.Device) {
  const capabilities = device.components?.[0].capabilities.reduce(
    (acc, capability) => object.assign(acc, capability.id, capability.status),
    {} as Types.Capabilities,
  );

  return (
    capabilities && {
      firstRemainingTime:
        (capabilities[CAPABILITIES.firstRemainingTime].remainingTime.value as BusCodeType) || '',
      secondRemainingTime:
        (capabilities[CAPABILITIES.secondRemainingTime].remainingTime.value as BusCodeType) || '',
      statusMessage: (capabilities[CAPABILITIES.statusMessage].message.value as string) || '',
    }
  );
}

type BusCodeType = keyof typeof busCodes & string;

const timeFormat = /(?<minutes>\d+(?=분))?\D*(?<seconds>\d+(?=초))/;

function toSeconds(time: string): number {
  const matches = timeFormat.exec(time);
  const minutes = matches?.groups?.minutes ?? 0;
  const seconds = matches?.groups?.seconds ?? 0;

  return +minutes * 60 + +seconds;
}

const statusFormat = /\d{2}:\d{2}:\d{2}/;

function extractUpdatedTime(status: string) {
  const match = status.match(statusFormat);

  return match && moment.utc(match[0], 'HH:mm:ss').subtract(9, 'hours');
}

function getElapsedTime(pastTime: moment.Moment) {
  return Math.trunc(moment.utc().diff(pastTime) / SECOND_IN_MS);
}

async function sendTimes(ctx: SmartAppContext, firstTime: number, secondTime: number) {
  await ctx.api.devices.sendCommand(getNotifier(ctx), [
    ...toTimeCommands(firstTime, secondTime),
    toMessageCommand(`${moment.utc().utcOffset('+09:00').format('HH:mm:ss')} 기준`),
  ]);
}

function toTimeCommands(firstSeconds: number, secondSeconds: number) {
  return [
    {
      capability: CAPABILITIES.firstRemainingTime,
      command: 'setTime',
      arguments: [toRemainingTime(firstSeconds)],
    },
    {
      capability: CAPABILITIES.secondRemainingTime,
      command: 'setTime',
      arguments: [toRemainingTime(secondSeconds)],
    },
  ];
}

function toRemainingTime(seconds: number) {
  if (seconds > 0) {
    return formatTime(seconds);
  }
  if (!seconds) {
    return arrivalText;
  }

  return seconds === busCodes.noBus ? noneText : blankText;
}

export async function handleNotifications(ctx: SmartAppContext): Promise<void> {
  const [notifier] = await ctx.api.devices.list({
    capability: [CAPABILITIES.firstRemainingTime, CAPABILITIES.secondRemainingTime],
    includeStatus: true,
  });

  const attributes = getAttributes(notifier);

  if (!attributes) {
    return sendError(ctx, MESSAGES.error);
  }

  const { firstRemainingTime, secondRemainingTime } = attributes;
  const displayedFirstTime = busCodes[firstRemainingTime] ?? toSeconds(firstRemainingTime);
  const displayedSecondTime = busCodes[secondRemainingTime] ?? toSeconds(secondRemainingTime);

  return sendNotifications(ctx, displayedFirstTime, displayedSecondTime);
}

async function sendNotifications(ctx: SmartAppContext, firstTime: number, secondTime: number) {
  const stopName = stopNames[`${getNotifier(ctx).deviceConfig?.deviceId}`] ?? '';
  const commands = [sendSpeech(ctx, toArrivalMessage(firstTime, secondTime, stopName))];

  if (firstTime <= BUSES.minTime && firstTime > 0) {
    commands.push(sendButtonPush(ctx));
  } else if (secondTime <= BUSES.minTime && secondTime > 0) {
    commands.push(sendButtonPush(ctx, true));
  }

  await Promise.all(commands);
}

function toArrivalMessage(firstSeconds: number, secondSeconds: number, stopName: string) {
  const firstTime = toArrivalTime(firstSeconds);
  const firstMessage = firstTime && `첫 번째 버스가 ${firstTime} 후 도착`;
  const secondTime = toArrivalTime(secondSeconds);
  const secondMessage = secondTime && `두 번째 버스가 ${secondTime} 후 도착`;
  const comma = ', ';
  const delimiter = firstMessage && secondMessage && comma;

  return `${stopName}${stopName && comma}${firstMessage}${delimiter}${secondMessage} 예정입니다`;
}

function toArrivalTime(seconds: number) {
  if (seconds <= 0) {
    return '';
  }

  return seconds > BUSES.minTime ? formatTime(seconds) : '잠시';
}

function formatTime(seconds: number) {
  return moment.utc(seconds * SECOND_IN_MS).format('m[분] s[초]');
}

async function sendButtonPush(ctx: SmartAppContext, double = false) {
  await ctx.api.devices.sendCommand(
    getNotifier(ctx),
    CAPABILITIES.notificationButton,
    'setButton',
    [double ? 'double' : 'pushed'],
  );
}
