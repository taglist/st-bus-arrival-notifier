import { SmartApp } from '@smartthings/smartapp';

import { CAPABILITIES, NODE_ENV, SCHEDULES } from '@/config';

import * as handlers from './handlers';
import * as app from './helpers/app';

const smartApp = new SmartApp()
  .enableEventLogging(2, NODE_ENV === 'development')
  .configureI18n()
  .page('mainPage', (_, page) => {
    page.section('devices', section => {
      section
        .deviceSetting('notifier')
        .capabilities([CAPABILITIES.firstRemainingTime, CAPABILITIES.secondRemainingTime])
        .required(true)
        .permissions('rx');

      section
        .deviceSetting('speakers')
        .capability(CAPABILITIES.speechSynthesis)
        .multiple(true)
        .permissions('x');
    });

    page.section('busInfo', section => {
      section.numberSetting('cityNumber').required(true);
      section.textSetting('stopCode').required(true);
      section.textSetting('routeCodes').required(true);
    });
  })

  .updated(async ctx => {
    await ctx.api.subscriptions.delete();
    await ctx.api.schedules.delete();
    await Promise.all([
      ctx.api.subscriptions.subscribeToDevices(
        ctx.config.notifier,
        'switch',
        'switch.on',
        'onHandler',
      ),
      ctx.api.subscriptions.subscribeToDevices(
        ctx.config.notifier,
        'switch',
        'switch.off',
        'offHandler',
      ),
    ]);

    await ctx.api.devices.sendCommand(app.getNotifier(ctx), 'switch', 'off');
  })
  .subscribedEventHandler('onHandler', handlers.handleOn)
  .subscribedEventHandler('offHandler', handlers.handleOff)
  .scheduledEventHandler(SCHEDULES.update, handlers.handleUpdate)
  .scheduledEventHandler(SCHEDULES.notifications, handlers.handleNotifications);

export default smartApp;
