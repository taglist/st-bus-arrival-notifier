import { SmartApp } from '@smartthings/smartapp';

import { CAPABILITIES } from '@/config';

import * as handlers from './handlers';

const smartApp = new SmartApp()
  .enableEventLogging(2)
  .configureI18n()
  .page('mainPage', (_, page) => {
    page.section('devices', section => {
      section
        .deviceSetting('notifier')
        .name('Select notifier')
        .capabilities([CAPABILITIES.firstRemainingTime, CAPABILITIES.secondRemainingTime])
        .required(true)
        .permissions('rx');

      section
        .deviceSetting('speakers')
        .name('Select speakers')
        .capability(CAPABILITIES.speechSynthesis)
        .multiple(true)
        .permissions('x');
    });

    page.section('busInfo', section => {
      section.numberSetting('cityNumber').name('cityNumber').required(true);
      section.textSetting('stopCode').name('stopCode').required(true);
      section.textSetting('routeCodes').name('routeCodes').required(true);
    });
  })

  .updated(async context => {
    await context.api.subscriptions.delete();
    await context.api.schedules.delete();
    await Promise.all([
      context.api.subscriptions.subscribeToDevices(
        context.config.notifier,
        'switch',
        'switch.on',
        'onHandler',
      ),
      context.api.subscriptions.subscribeToDevices(
        context.config.notifier,
        'switch',
        'switch.off',
        'offHandler',
      ),
    ]);
  })
  .subscribedEventHandler('onHandler', handlers.handleOn)
  .subscribedEventHandler('offHandler', handlers.handleOff);

export default smartApp;
