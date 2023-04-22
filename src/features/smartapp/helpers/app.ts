import type * as st from '@smartthings/core-sdk';
import type { SmartAppContext } from '@smartthings/smartapp';
import moment from 'moment';

import { BUSES, CAPABILITIES, COMMONS, MESSAGES } from '@/config';
import db from '@/lib/db';

import * as time from '../utils/time';

export function getDeviceId(ctx: SmartAppContext): string {
  return getNotifier(ctx).deviceConfig?.deviceId as string;
}

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

async function extractPreferences(ctx: SmartAppContext, deviceId: string) {
  const preferences = await ctx.api.devices.getPreferences(deviceId);

  return preferences.values as Types.Preferences;
}

export function initializeStates(
  deviceId: string,
  arrivalInfo: Types.StopArrivalInfo,
  options: Preferences,
): readonly [number, number] {
  const { buses } = arrivalInfo;
  const firstArrivalTime = buses[0].arrivalTime;
  const secondArrivalTime = buses[1]?.arrivalTime ?? COMMONS.noBus;
  const arrivalTimes = [firstArrivalTime, secondArrivalTime] as const;
  const initialStates = {
    arrivalTimes,
    progress: Infinity,
    errorCount: 0,
    stopName: options.stopNameRequired ? arrivalInfo.stop.name : '',
    routeNumbers: options.routeNumberRequired ? extractRouteNumbers(buses) : ['', ''],
    buttonStatus: 'ready',
    notificationInterval: options.notificationInterval,
  };

  db.set(deviceId, initialStates).write();

  return arrivalTimes;
}

interface DeviceStates {
  progress: number;
  errorCount: number;
  stopName: string;
  routeNumbers: string[];
  arrivalTimes: [number, number];
  remainingTimes: [number, number];
  updatedTime: number;
  buttonStatus: ButtonStatusType;
  notificationInterval: number;
}

export type ButtonStatusType = 'ready' | 'pushed' | 'double';

function extractRouteNumbers(arrivalInfo: Types.BusArrivalInfo[]) {
  const firstRouteNumber = extractRouteNumber(arrivalInfo[0].name);
  const secondRouteNumber = extractRouteNumber(arrivalInfo[1]?.name);

  return [firstRouteNumber, secondRouteNumber];
}

const routeNameFormat = /^[^(]+/;

function extractRouteNumber(name: string) {
  if (!name) {
    return '';
  }

  const result = name.match(routeNameFormat)?.[0];

  return result ? result.trim() : '';
}

export function hasRouteNumber(deviceId: string): boolean {
  const routeNumbers = db.get(`${deviceId}.routeNumbers`).value();

  return !!(routeNumbers[0] || routeNumbers[1]);
}

export function saveRouteNumbers(deviceId: string, arrivalInfo: Types.BusArrivalInfo[]): void {
  db.set(`${deviceId}.routeNumbers`, extractRouteNumbers(arrivalInfo)).write();
}

export function getAttributes(deviceId: string): Attributes {
  const device = db.get(deviceId).value() as DeviceStates;

  return {
    firstDisplayedTime: device.remainingTimes[0],
    secondDisplayedTime: device.remainingTimes[1],
    lastUpdatedTime: device.updatedTime,
    buttonStatus: device.buttonStatus,
  };
}

interface Attributes {
  firstDisplayedTime: number;
  secondDisplayedTime: number;
  lastUpdatedTime: number;
  buttonStatus: ButtonStatusType;
}

export async function sendError(
  ctx: SmartAppContext,
  message: string,
  forced = true,
): Promise<void> {
  if (!forced) {
    const key = `${getDeviceId(ctx)}.errorCount`;
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
  firstSeconds: number,
  secondSeconds: number,
): Promise<void> {
  const deviceId = getDeviceId(ctx);
  const now = Date.now();

  db.set(`${deviceId}.updatedTime`, now).value();
  db.set(`${deviceId}.remainingTimes`, [firstSeconds, secondSeconds]).value();
  db.write();

  await Promise.all([
    ctx.api.devices.sendCommand(getNotifier(ctx), [
      ...toTimeCommands(firstSeconds, secondSeconds),
      toMessageCommand(`${moment.utc(now).utcOffset('+09:00').format('HH:mm:ss')} 기준`),
    ]),
    ensureNotifications(ctx, firstSeconds, secondSeconds),
  ]);
}

function toTimeCommands(firstSeconds: number, secondSeconds: number) {
  return [
    {
      capability: CAPABILITIES.firstRemainingTime,
      command: 'setTime',
      arguments: [toFormattedTime(firstSeconds)],
    },
    {
      capability: CAPABILITIES.secondRemainingTime,
      command: 'setTime',
      arguments: [toFormattedTime(secondSeconds)],
    },
  ];
}

function toFormattedTime(seconds: number) {
  if (seconds > 0) {
    return time.formatTime(seconds);
  }
  if (seconds === 0) {
    return MESSAGES.arrival;
  }

  return seconds === COMMONS.noBus ? MESSAGES.none : MESSAGES.blank;
}

async function ensureNotifications(
  ctx: SmartAppContext,
  firstSeconds: number,
  secondSeconds: number,
) {
  const deviceId = getDeviceId(ctx);
  const device = db.get(deviceId).value() as DeviceStates;
  const progress = device.progress + 1;

  if (progress < device.notificationInterval) {
    db.set(`${deviceId}.progress`, progress).write();

    return Promise.resolve();
  }

  db.set(`${deviceId}.progress`, 0).value();

  const options = {
    firstSeconds,
    secondSeconds,
    stopName: device.stopName,
    routeNumbers: device.routeNumbers,
  };

  const commands = [sendSpeech(ctx, toNotificationMessage(options))];

  if (firstSeconds <= BUSES.minTime && device.buttonStatus === 'ready') {
    db.set(`${deviceId}.buttonStatus`, 'pushed').value();
    commands.push(sendButtonStatus(ctx, 'pushed'));
  } else if (secondSeconds <= BUSES.minTime && device.buttonStatus !== 'double') {
    db.set(`${deviceId}.buttonStatus`, 'double').value();
    commands.push(sendButtonStatus(ctx, 'double'));
  }

  db.write();
  await Promise.all(commands);

  return undefined;
}

function toNotificationMessage(options: NotificationOptions) {
  const { routeNumbers, stopName } = options;
  const firstMessage = toArrivalMessage(options.firstSeconds, routeNumbers[0], 0);
  const routeNumber = firstMessage ? routeNumbers[1] : routeNumbers[0] || routeNumbers[1];
  const secondMessage = toArrivalMessage(options.secondSeconds, routeNumber, 1);
  const comma = ', ';
  const delimiter = firstMessage && secondMessage && comma;

  return (
    (firstMessage || secondMessage) &&
    `${stopName}${stopName && comma}${firstMessage}${delimiter}${secondMessage} 예정입니다`
  );
}

interface NotificationOptions extends Pick<DeviceStates, 'stopName' | 'routeNumbers'> {
  firstSeconds: number;
  secondSeconds: number;
}

const ordinals = ['첫 번째', '두 번째'];

function toArrivalMessage(seconds: number, routeNumber: string, order: number) {
  const arrivalTime = toArrivalTime(seconds);
  const busName = routeNumber ? `${routeNumber}번` : ordinals[order];

  return arrivalTime && `${busName} 버스가 ${arrivalTime} 후 도착`;
}

function toArrivalTime(seconds: number) {
  if (seconds <= 0) {
    return '';
  }

  return seconds > BUSES.minTime ? time.formatTime(seconds) : '잠시';
}

async function sendButtonStatus(ctx: SmartAppContext, status: ButtonStatusType) {
  await ctx.api.devices.sendCommand(
    getNotifier(ctx),
    CAPABILITIES.notificationButton,
    'setButton',
    [status],
  );
}
