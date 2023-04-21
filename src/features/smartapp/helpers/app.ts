import type * as st from '@smartthings/core-sdk';
import type { SmartAppContext } from '@smartthings/smartapp';
import type { Dictionary } from '@taglist/types';
import moment from 'moment';
import { object } from 'ryutils';

import { BUSES, CAPABILITIES, COMMONS, MESSAGES } from '@/config';
import db from '@/lib/db';

import * as time from '../utils/time';

export function getNotifier(ctx: SmartAppContext): st.ConfigEntry {
  return ctx.config.notifier[0];
}

export function getConfig(ctx: SmartAppContext): Config {
  return {
    cityNumber: ctx.configNumberValue('cityNumber'),
    stopCode: ctx.configStringValue('stopCode'),
    routeCodes: ctx.configStringValue('routeCodes').split(','),
  };
}

interface Config {
  cityNumber: number;
  stopCode: string;
  routeCodes: string[];
}

export async function getPreferences(ctx: SmartAppContext, deviceId: string): Promise<Preferences> {
  const preferences = await extractPreferences(ctx, deviceId);

  return {
    notificationInterval: preferences.notificationInterval.value || 3,
    stopNameRequired: preferences.stopNameRequired.value,
    routeNumberRequired: preferences.routeNumberRequired.value,
  };
}

interface Preferences {
  notificationInterval: number;
  stopNameRequired: boolean;
  routeNumberRequired: boolean;
}

const stopNames = {} as Dictionary;

export const routeNumbers = {} as Dictionary;

export function hasRouteNumber(deviceId: string): boolean {
  return routeNumbers[deviceId][0] || routeNumbers[deviceId][1];
}

export function initializeData(
  deviceId: string,
  arrivalInfo: Types.StopArrivalInfo,
  options: { stopNameRequired: boolean; routeNumberRequired: boolean },
): readonly [number, number] {
  const firstArrivalTime = arrivalInfo.buses[0].arrivalTime;
  const secondArrivalTime = arrivalInfo.buses[1]?.arrivalTime ?? COMMONS.noBus;
  const arrivalTimes = [firstArrivalTime, secondArrivalTime] as const;

  db.set(`${deviceId}.arrivalInfo`, arrivalTimes).value();
  db.set(`${deviceId}.errorCount`, 0).value();
  db.write();
  stopNames[deviceId] = options.stopNameRequired ? arrivalInfo.stop.name : '';
  routeNumbers[deviceId] = [null, null];

  if (options.routeNumberRequired) {
    saveRouteNumbers(deviceId, arrivalInfo.buses);
  }

  return arrivalTimes;
}

export function saveRouteNumbers(deviceId: string, arrivalInfo: Types.BusArrivalInfo[]): void {
  const firstRouteNumber = extractRouteNumber(arrivalInfo[0].name);
  const secondRouteNumber = extractRouteNumber(arrivalInfo[1]?.name);

  routeNumbers[deviceId] = [firstRouteNumber, secondRouteNumber];
}

const routeNameFormat = /^[^(]+/;

function extractRouteNumber(name: string) {
  if (!name) {
    return '';
  }

  const result = name.match(routeNameFormat)?.[0];

  return result ? result.trim() : '';
}

async function extractPreferences(ctx: SmartAppContext, deviceId: string) {
  const preferences = await ctx.api.devices.getPreferences(deviceId);

  return preferences.values as Types.Preferences;
}

export function getAttributes(device: st.Device): Attributes | undefined {
  const capabilities = device.components?.[0].capabilities.reduce(
    (acc, capability) => object.assign(acc, capability.id, capability.status),
    {} as Types.Capabilities,
  );

  return (
    capabilities && {
      firstRemainingTime:
        (capabilities[CAPABILITIES.firstRemainingTime].remainingTime.value as CommonCodeType) || '',
      secondRemainingTime:
        (capabilities[CAPABILITIES.secondRemainingTime].remainingTime.value as CommonCodeType) ||
        '',
      statusMessage: (capabilities[CAPABILITIES.statusMessage].message.value as string) || '',
      notificationButton:
        (capabilities[CAPABILITIES.notificationButton].button.value as ButtonStatusType) || '',
    }
  );
}

export type CommonCodeType = keyof typeof COMMONS & string;

export type ButtonStatusType = 'ready' | 'pushed' | 'double';

interface Attributes {
  firstRemainingTime: CommonCodeType;
  secondRemainingTime: CommonCodeType;
  statusMessage: string;
  notificationButton: ButtonStatusType;
}

export async function sendError(
  ctx: SmartAppContext,
  message: string,
  forced = true,
): Promise<void> {
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

export async function sendTimes(
  ctx: SmartAppContext,
  firstTime: number,
  secondTime: number,
): Promise<void> {
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
    return time.formatTime(seconds);
  }
  if (!seconds) {
    return MESSAGES.arrival;
  }

  return seconds === COMMONS.noBus ? MESSAGES.none : MESSAGES.blank;
}

export async function sendNotifications(
  ctx: SmartAppContext,
  firstTime: number,
  secondTime: number,
  buttonStatus = 'ready',
): Promise<void> {
  const deviceId = getNotifier(ctx).deviceConfig?.deviceId as string;
  const stopName = stopNames[deviceId] ?? '';
  const routes = routeNumbers[deviceId] ?? [null, null];
  const commands = [sendSpeech(ctx, toArrivalMessage(firstTime, secondTime, stopName, routes))];

  if (firstTime <= BUSES.minTime && buttonStatus === 'ready') {
    commands.push(sendButtonPush(ctx));
  } else if (secondTime <= BUSES.minTime && buttonStatus !== 'double') {
    commands.push(sendButtonPush(ctx, true));
  }

  await Promise.all(commands);
}

function toArrivalMessage(
  firstSeconds: number,
  secondSeconds: number,
  stopName: string,
  routes: ReadonlyArray<string | null>,
) {
  const firstTime = toArrivalTime(firstSeconds);
  const firstName = routes[0] ? `${routes[0]}번` : '첫 번째';
  const firstMessage = firstTime && `${firstName} 버스가 ${firstTime} 후 도착`;

  const secondTime = toArrivalTime(secondSeconds);
  const secondNumber = firstTime ? routes[1] : routes[0] || routes[1];
  const secondName = secondNumber ? `${secondNumber}번` : '두 번째';
  const secondMessage = secondTime && `${secondName} 버스가 ${secondTime} 후 도착`;

  const comma = ', ';
  const delimiter = firstMessage && secondMessage && comma;

  return (
    (firstMessage || secondMessage) &&
    `${stopName}${stopName && comma}${firstMessage}${delimiter}${secondMessage} 예정입니다`
  );
}

function toArrivalTime(seconds: number) {
  if (seconds <= 0) {
    return '';
  }

  return seconds > BUSES.minTime ? time.formatTime(seconds) : '잠시';
}

async function sendButtonPush(ctx: SmartAppContext, double = false) {
  await ctx.api.devices.sendCommand(
    getNotifier(ctx),
    CAPABILITIES.notificationButton,
    'setButton',
    [double ? 'double' : 'pushed'],
  );
}
