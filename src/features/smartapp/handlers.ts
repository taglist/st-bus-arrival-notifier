import { SmartAppContext } from '@smartthings/smartapp';
import { MINUTE_IN_SECONDS, SECOND_IN_MS, STATUS_CODES } from '@taglist/constants';
import * as errors from '@taglist/errors';
import moment from 'moment';

import { CAPABILITIES, MESSAGES } from '@/config';
import { BusService } from '@/features/buses';

const busCodes = {
  noBus: -1,
  blank: -999,
};

export async function handleOn(ctx: SmartAppContext): Promise<void> {
  const { cityNumber, stopCode, routeCodes } = getConfig(ctx);
  const arrivalInfo = await retrieveArrivalInfo(cityNumber, stopCode, routeCodes);

  if (typeof arrivalInfo === 'string') {
    return sendError(ctx, arrivalInfo);
  }

  const firstSeconds = arrivalInfo.buses[0].arrivalTime;
  const secondSeconds = arrivalInfo.buses[1]?.arrivalTime ?? busCodes.noBus;

  await Promise.all([
    ctx.api.devices.sendCommand(getNotifier(ctx), [
      ...toTimeCommands(firstSeconds, secondSeconds),
      toMessageCommand(`${moment().format('HH:mm:ss')} 기준`),
    ]),
    sendSpeech(ctx, toArrivalMessage(firstSeconds, secondSeconds)),
  ]);

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
    console.error(err);

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

async function sendError(ctx: SmartAppContext, message: string) {
  await Promise.all([sendSwitchOff(ctx), sendNotifications(ctx, message)]);
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

async function sendNotifications(ctx: SmartAppContext, message: string) {
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
  await ctx.api.devices.sendCommands(ctx.config.speakers, [toSpeakCommand(phrase)], '');
}

function toSpeakCommand(phrase: string) {
  return {
    capability: CAPABILITIES.speechSynthesis,
    command: 'speak',
    arguments: [phrase],
  };
}

function toArrivalMessage(firstSeconds: number, secondSeconds: number) {
  const firstTime = toArrivalTime(firstSeconds);
  const firstMessage = firstTime && `첫 번째 버스가 ${firstTime} 후 도착,`;
  const secondTime = toArrivalTime(secondSeconds);
  const secondMessage = secondTime && `두 번째 버스가 ${secondTime} 후 도착`;
  const delimiter = firstMessage && secondMessage && ', ';

  return `${firstMessage}${delimiter}${secondMessage} 예정입니다`;
}

const minTime = 5 * MINUTE_IN_SECONDS;

function toArrivalTime(seconds: number) {
  if (seconds <= 0) {
    return '';
  }

  return seconds > minTime ? formatTime(seconds) : '잠시';
}

function formatTime(seconds: number) {
  return moment.utc(seconds * SECOND_IN_MS).format('m[분] s[초]');
}

export async function handleOff(ctx: SmartAppContext): Promise<void> {
  await Promise.all([
    ctx.api.devices.sendCommand(getNotifier(ctx), toTimeCommands(busCodes.blank, busCodes.blank)),
  ]);
}

function getNotifier(ctx: SmartAppContext) {
  return ctx.config.notifier[0];
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
    return '도착';
  }

  return seconds === busCodes.noBus ? '없음' : '-';
}
