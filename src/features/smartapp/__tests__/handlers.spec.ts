import { MINUTE_IN_SECONDS } from '@taglist/constants';
import moment from 'moment';
import { random } from 'ryutils';

import { BUSES, MESSAGES } from '@/config';
import { BusService } from '@/features/buses';
import db from '@/lib/db';

import * as handlers from '../handlers';
import * as app from '../helpers/app';
import * as mocks from '../mocks';
import * as time from '../utils/time';

jest.mock('@/features/buses');
jest.mock('../helpers/app');
jest.mock('../utils/time', () => ({
  ...jest.requireActual('../utils/time'),
  extractUpdatedTime: jest.fn(),
  getElapsedTime: jest.fn(),
}));

const mockBusService = BusService as jest.Mocked<typeof BusService>;
const mockApp = app as jest.Mocked<typeof app>;
const mockTime = time as jest.Mocked<typeof time>;

const arrivalInfoKey = `${mocks.deviceId}.arrivalInfo`;
const thresholdTime = BUSES.thresholdTime - 1 * MINUTE_IN_SECONDS;

beforeEach(() => {
  mockApp.getConfig.mockReturnValue(mocks.config);
  mockTime.extractUpdatedTime.mockReturnValue(moment.utc());
  mockTime.getElapsedTime.mockReturnValue(mocks.elapsedTime);
});

describe('handleUpdate', () => {
  describe('when the first bus has already arrived', () => {
    beforeAll(() => {
      db.set(arrivalInfoKey, [0, 0]).write();
    });

    // * and the arrival information has been updated
    it.each([
      getValidUpdateCase([0, 628], true),
      getValidUpdateCase([0, 381], true),
      getValidUpdateCase([0, 237], true),
      getValidUpdateCase([0, 110], true),
      getValidUpdateCase([0, 57], true),
      getValidUpdateCase([0, 32], true),
      getValidUpdateCase([0, 15], true),
      getValidUpdateCase([0, 1], true),
    ])('should send times $results', async ({ attributes, arrivalInfo, results }) => {
      mockApp.getAttributes.mockReturnValue(attributes);
      mockBusService.retrieveArrivalInfo.mockResolvedValue({
        stop: mocks.stop,
        buses: arrivalInfo,
      });

      await handlers.handleUpdate(mocks.ctx);

      expect(app.sendTimes).toBeCalledWith(mocks.ctx, ...results);
    });

    it.each([
      { displayedTimes: [0, 135], arrivalTimes: [135 + thresholdTime] },
      { displayedTimes: [0, 59], arrivalTimes: [59 + thresholdTime] },
      { displayedTimes: [0, 38], arrivalTimes: [38 + thresholdTime] },
    ])(
      `should send an error (${MESSAGES.busAlreadyArrived})`,
      async ({ displayedTimes, arrivalTimes }) => {
        const { attributes, arrivalInfo } = toUpdateCase(displayedTimes, arrivalTimes, '');

        mockApp.getAttributes.mockReturnValue(attributes);
        mockBusService.retrieveArrivalInfo.mockResolvedValue({
          stop: mocks.stop,
          buses: arrivalInfo,
        });

        await handlers.handleUpdate(mocks.ctx);

        expect(app.sendError).toBeCalledWith(mocks.ctx, MESSAGES.busAlreadyArrived);
      },
    );

    it.each([
      { displayedTimes: [0, 714], arrivalTimes: [714 + thresholdTime] },
      { displayedTimes: [0, 398], arrivalTimes: [398 + thresholdTime] },
      { displayedTimes: [0, 252], arrivalTimes: [252 + thresholdTime] },
    ])(
      `should send an error (${MESSAGES.busMissing})`,
      async ({ displayedTimes, arrivalTimes }) => {
        const { attributes, arrivalInfo } = toUpdateCase(displayedTimes, arrivalTimes, '');

        mockApp.getAttributes.mockReturnValue(attributes);
        mockBusService.retrieveArrivalInfo.mockResolvedValue({
          stop: mocks.stop,
          buses: arrivalInfo,
        });

        await handlers.handleUpdate(mocks.ctx);

        expect(app.sendError).toBeCalledWith(mocks.ctx, MESSAGES.busMissing);
      },
    );

    // * and the arrival information has not been updated
    it.each([
      getValidUpdateCase([0, 628], false),
      getValidUpdateCase([0, 381], false),
      getValidUpdateCase([0, 237], false),
      getValidUpdateCase([0, 110], false),
    ])('should send times $results', async ({ attributes, arrivalInfo, results }) => {
      mockApp.getAttributes.mockReturnValue(attributes);
      mockBusService.retrieveArrivalInfo.mockResolvedValue({
        stop: mocks.stop,
        buses: arrivalInfo,
      });

      const arrivalTimes = [arrivalInfo[0].arrivalTime, arrivalInfo[1].arrivalTime];

      db.set(arrivalInfoKey, arrivalTimes).write();

      await handlers.handleUpdate(mocks.ctx);

      return expect(app.sendTimes).toBeCalledWith(mocks.ctx, ...results);
    });

    it.each([
      getValidUpdateCase([0, 57], false),
      getValidUpdateCase([0, 32], false),
      getValidUpdateCase([0, 15], false),
      getValidUpdateCase([0, 1], false),
    ])(`should send an error (${MESSAGES.busArrived})`, async ({ attributes, arrivalInfo }) => {
      mockApp.getAttributes.mockReturnValue(attributes);
      mockBusService.retrieveArrivalInfo.mockResolvedValue({
        stop: mocks.stop,
        buses: arrivalInfo,
      });

      const arrivalTimes = [arrivalInfo[0].arrivalTime, arrivalInfo[1].arrivalTime];

      db.set(arrivalInfoKey, arrivalTimes).write();

      await handlers.handleUpdate(mocks.ctx);

      expect(app.sendError).toBeCalledWith(mocks.ctx, MESSAGES.busArrived);
    });
  });

  describe('when the first bus has not arrived', () => {
    beforeAll(() => {
      db.set(arrivalInfoKey, [0, 0]).write();
    });

    // * and the arrival information has been updated
    it.each([
      getValidUpdateCase([714, -1], true),
      getValidUpdateCase([398, -1], true),
      getValidUpdateCase([252, -1], true),
      getValidUpdateCase([135, -1], true),
      getValidUpdateCase([59, -1], true),
      getValidUpdateCase([38, -1], true),
      getValidUpdateCase([12, -1], true),
      getValidUpdateCase([1, -1], true),
    ])('should send times $results', async ({ attributes, arrivalInfo, results }) => {
      mockApp.getAttributes.mockReturnValue(attributes);
      mockBusService.retrieveArrivalInfo.mockResolvedValue({
        stop: mocks.stop,
        buses: arrivalInfo,
      });

      await handlers.handleUpdate(mocks.ctx);

      expect(app.sendTimes).toBeCalledWith(mocks.ctx, ...results);
    });

    it.each([
      { displayedTimes: [135, -1], arrivalTimes: [135 + thresholdTime] },
      { displayedTimes: [59, -1], arrivalTimes: [59 + thresholdTime] },
      { displayedTimes: [38, -1], arrivalTimes: [38 + thresholdTime] },
    ])(
      `should send an error (${MESSAGES.busAlreadyArrived})`,
      async ({ displayedTimes, arrivalTimes }) => {
        const { attributes, arrivalInfo } = toUpdateCase(displayedTimes, arrivalTimes, '');

        mockApp.getAttributes.mockReturnValue(attributes);
        mockBusService.retrieveArrivalInfo.mockResolvedValue({
          stop: mocks.stop,
          buses: arrivalInfo,
        });

        await handlers.handleUpdate(mocks.ctx);

        expect(app.sendError).toBeCalledWith(mocks.ctx, MESSAGES.busAlreadyArrived);
      },
    );

    it.each([
      { displayedTimes: [714, -1], arrivalTimes: [714 + thresholdTime] },
      { displayedTimes: [398, -1], arrivalTimes: [398 + thresholdTime] },
      { displayedTimes: [252, -1], arrivalTimes: [252 + thresholdTime] },
    ])(
      `should send an error (${MESSAGES.busMissing})`,
      async ({ displayedTimes, arrivalTimes }) => {
        const { attributes, arrivalInfo } = toUpdateCase(displayedTimes, arrivalTimes, '');

        mockApp.getAttributes.mockReturnValue(attributes);
        mockBusService.retrieveArrivalInfo.mockResolvedValue({
          stop: mocks.stop,
          buses: arrivalInfo,
        });

        await handlers.handleUpdate(mocks.ctx);

        expect(app.sendError).toBeCalledWith(mocks.ctx, MESSAGES.busMissing);
      },
    );

    // * and the arrival information has not been updated
    it.each([
      getValidUpdateCase([714, -1], false),
      getValidUpdateCase([398, -1], false),
      getValidUpdateCase([252, -1], false),
      getValidUpdateCase([135, -1], false),
    ])('should send times $results', async ({ attributes, arrivalInfo, results }) => {
      mockApp.getAttributes.mockReturnValue(attributes);
      mockBusService.retrieveArrivalInfo.mockResolvedValue({
        stop: mocks.stop,
        buses: arrivalInfo,
      });

      const arrivalTimes = [
        arrivalInfo[0].arrivalTime,
        arrivalInfo[1] ? arrivalInfo[1].arrivalTime : -1,
      ];

      db.set(arrivalInfoKey, arrivalTimes).write();

      await handlers.handleUpdate(mocks.ctx);

      return expect(app.sendTimes).toBeCalledWith(mocks.ctx, ...results);
    });

    it.each([
      getValidUpdateCase([59, -1], false),
      getValidUpdateCase([38, -1], false),
      getValidUpdateCase([12, -1], false),
      getValidUpdateCase([1, -1], false),
    ])(`should send an error (${MESSAGES.busArrived})`, async ({ attributes, arrivalInfo }) => {
      mockApp.getAttributes.mockReturnValue(attributes);
      mockBusService.retrieveArrivalInfo.mockResolvedValue({
        stop: mocks.stop,
        buses: arrivalInfo,
      });

      const arrivalTimes = [
        arrivalInfo[0].arrivalTime,
        arrivalInfo[1] ? arrivalInfo[1].arrivalTime : -1,
      ];

      db.set(arrivalInfoKey, arrivalTimes).write();

      await handlers.handleUpdate(mocks.ctx);

      expect(app.sendError).toBeCalledWith(mocks.ctx, MESSAGES.busArrived);
    });
  });

  describe('when neither the first nor the second bus has arrived', () => {
    beforeAll(() => {
      db.set(arrivalInfoKey, [0, 0]).write();
    });

    // * when the remaining time of the first bus is more than the available time
    // and the expected arrival time is reduced - 1
    // and the expected arrival time is increased - 2
    // and the expected arrival time is reduced by more than the threshold - 3
    // and the expected arrival time is increased by more than the threshold - 4

    // * when the remaining time of the first bus is within the available time
    // and the expected arrival time is reduced - 5
    // and the expected arrival time is increased - 6
    // and the expected arrival time is reduced by more than the threshold - 7
    // and the expected arrival time is increased by more than the threshold - 8

    describe('and the arrival information has been updated', () => {
      it.each([
        // 1
        { displayedTimes: [298, 459], arrivalTimes: [272, 428] },
        { displayedTimes: [272, 428], arrivalTimes: [200, 396] },
        { displayedTimes: [200, 396], arrivalTimes: [163, 407] },
        { displayedTimes: [163, 407], arrivalTimes: [125, 452] },
        // 2
        { displayedTimes: [419, 559], arrivalTimes: [538, 678] },
        { displayedTimes: [363, 518], arrivalTimes: [419, 559] },
        { displayedTimes: [335, 544], arrivalTimes: [363, 544 + thresholdTime] },
        { displayedTimes: [298, 603], arrivalTimes: [335, 603 + thresholdTime] },
        // 3
        {
          displayedTimes: [419, 559],
          arrivalTimes: [419 - thresholdTime - 1, 559 - thresholdTime - 1],
        },
        {
          displayedTimes: [363, 518],
          arrivalTimes: [363 - thresholdTime - 1, 518 - thresholdTime - 1],
        },
        { displayedTimes: [349, 450], arrivalTimes: [349 - thresholdTime - 1, 401] },
        { displayedTimes: [306, 411], arrivalTimes: [306 - thresholdTime - 1, 356] },
        { displayedTimes: [235, 287], arrivalTimes: [235 - thresholdTime - 1, 307] },
        { displayedTimes: [176, 201], arrivalTimes: [176 - thresholdTime - 1, 259] },
        // 5
        { displayedTimes: [125, 253], arrivalTimes: [62, 215] },
        { displayedTimes: [62, 215], arrivalTimes: [43, 176] },
        { displayedTimes: [43, 176], arrivalTimes: [16, 223] },
        { displayedTimes: [32, 125], arrivalTimes: [2, 240] },
        { displayedTimes: [28, 34], arrivalTimes: [6, 28] },
        { displayedTimes: [28, 34], arrivalTimes: [2, 99] },
        // 6
        { displayedTimes: [179, 253], arrivalTimes: [279, 301] },
        { displayedTimes: [125, 215], arrivalTimes: [158, 253] },
        { displayedTimes: [162, 253], arrivalTimes: [228, 241] },
        { displayedTimes: [125, 215], arrivalTimes: [156, 183] },
        { displayedTimes: [100, 1024], arrivalTimes: [199, 1592] },
        { displayedTimes: [64, 879], arrivalTimes: [180, 1482] },
      ])(
        'should send times (displayed: $displayedTimes, results: $arrivalTimes)',
        async ({ displayedTimes, arrivalTimes }) => {
          const { attributes, arrivalInfo } = toUpdateCase(displayedTimes, arrivalTimes, '');

          mockApp.getAttributes.mockReturnValue(attributes);
          mockBusService.retrieveArrivalInfo.mockResolvedValue({
            stop: mocks.stop,
            buses: arrivalInfo,
          });

          await handlers.handleUpdate(mocks.ctx);

          expect(app.sendTimes).toBeCalledWith(mocks.ctx, ...arrivalTimes);
        },
      );

      it.each([
        // 4
        { displayedTimes: [419, 559], arrivalTimes: [419 + thresholdTime, 559 + thresholdTime] },
        { displayedTimes: [363, 518], arrivalTimes: [363 + thresholdTime, 518 + thresholdTime] },
        { displayedTimes: [235, 287], arrivalTimes: [235 + thresholdTime, 1059] },
        { displayedTimes: [176, 201], arrivalTimes: [176 + thresholdTime, 833] },
        // 5
        { displayedTimes: [125, 253], arrivalTimes: [62, 253 + thresholdTime] },
        { displayedTimes: [62, 215], arrivalTimes: [43, 215 + thresholdTime] },
        { displayedTimes: [43, 176], arrivalTimes: [16, 768] },
        { displayedTimes: [16, 125], arrivalTimes: [2, 1142] },
        // 6
        { displayedTimes: [179, 253], arrivalTimes: [279, 1301] },
        { displayedTimes: [121, 176], arrivalTimes: [180, 1129] },
        { displayedTimes: [65, 146], arrivalTimes: [65, 146 + thresholdTime] },
        { displayedTimes: [16, 125], arrivalTimes: [3, 125 + thresholdTime] },
        // 8
        { displayedTimes: [173, 328], arrivalTimes: [381, 401] },
        { displayedTimes: [115, 259], arrivalTimes: [302, 1639] },
        { displayedTimes: [79, 192], arrivalTimes: [298, 1529] },
        { displayedTimes: [77, 281], arrivalTimes: [132, 1056] },
        { displayedTimes: [14, 183], arrivalTimes: [235, 257] },
        { displayedTimes: [158, 1059], arrivalTimes: [158 + thresholdTime, 987] },
        { displayedTimes: [75, 1059], arrivalTimes: [75 + thresholdTime, 987] },
      ])(
        'should send times (displayed: $displayedTimes, results: $arrivalTimes)',
        async ({ displayedTimes, arrivalTimes }) => {
          const { attributes, arrivalInfo } = toUpdateCase(displayedTimes, arrivalTimes, '');

          mockApp.getAttributes.mockReturnValue(attributes);
          mockBusService.retrieveArrivalInfo.mockResolvedValue({
            stop: mocks.stop,
            buses: arrivalInfo,
          });

          await handlers.handleUpdate(mocks.ctx);

          expect(app.sendTimes).toBeCalledWith(mocks.ctx, 0, arrivalTimes[0]);
        },
      );

      it.each([
        // 4
        { displayedTimes: [419, 559], arrivalTimes: [841, 1159] },
        { displayedTimes: [235, 287], arrivalTimes: [599, 1200] },
        { displayedTimes: [176, 201], arrivalTimes: [444, 833] },
        // 8
        { displayedTimes: [125, 253], arrivalTimes: [592, 2509] },
        { displayedTimes: [62, 215], arrivalTimes: [663, 1259] },
        { displayedTimes: [28, 200], arrivalTimes: [498, 1000] },
      ])(
        `should send an error (${MESSAGES.busMissing}, results: $arrivalTimes)`,
        async ({ displayedTimes, arrivalTimes }) => {
          const { attributes, arrivalInfo } = toUpdateCase(displayedTimes, arrivalTimes, '');

          mockApp.getAttributes.mockReturnValue(attributes);
          mockBusService.retrieveArrivalInfo.mockResolvedValue({
            stop: mocks.stop,
            buses: arrivalInfo,
          });

          await handlers.handleUpdate(mocks.ctx);

          expect(app.sendError).toBeCalledWith(mocks.ctx, MESSAGES.busMissing);
        },
      );

      it.each([
        // 8
        { displayedTimes: [125, 176], arrivalTimes: [592, 2509] },
        { displayedTimes: [62, 112], arrivalTimes: [663, 1259] },
        { displayedTimes: [28, 54], arrivalTimes: [498, 1000] },
      ])(
        `should send an error (${MESSAGES.busAlreadyArrived}, results: $arrivalTimes)`,
        async ({ displayedTimes, arrivalTimes }) => {
          const { attributes, arrivalInfo } = toUpdateCase(displayedTimes, arrivalTimes, '');

          mockApp.getAttributes.mockReturnValue(attributes);
          mockBusService.retrieveArrivalInfo.mockResolvedValue({
            stop: mocks.stop,
            buses: arrivalInfo,
          });

          await handlers.handleUpdate(mocks.ctx);

          expect(app.sendError).toBeCalledWith(mocks.ctx, MESSAGES.busAlreadyArrived);
        },
      );
    });

    describe('and the arrival information has not been updated', () => {
      beforeAll(() => {
        db.set(arrivalInfoKey, [0, 0]).write();
      });

      it.each([
        { displayedTimes: [419, 559], results: [419 - mocks.elapsedTime, 559 - mocks.elapsedTime] },
        { displayedTimes: [235, 287], results: [235 - mocks.elapsedTime, 287 - mocks.elapsedTime] },
        {
          displayedTimes: [125, 253],
          results: [125 - mocks.elapsedTime, 253 - mocks.elapsedTime],
        },
        {
          displayedTimes: [62, 215],
          results: [62 - mocks.elapsedTime, 215 - mocks.elapsedTime],
        },
      ])(
        'should send times (displayed: $displayedTimes, results: $results)',
        async ({ displayedTimes, results }) => {
          const { attributes, arrivalInfo } = toUpdateCase(displayedTimes, [0, 0], '');

          mockApp.getAttributes.mockReturnValue(attributes);
          mockBusService.retrieveArrivalInfo.mockResolvedValue({
            stop: mocks.stop,
            buses: arrivalInfo,
          });

          await handlers.handleUpdate(mocks.ctx);

          return expect(app.sendTimes).toBeCalledWith(mocks.ctx, ...results);
        },
      );

      it.each([
        { displayedTimes: [57, 559], results: [0, 559 - mocks.elapsedTime] },
        { displayedTimes: [43, 287], results: [0, 287 - mocks.elapsedTime] },
        {
          displayedTimes: [18, 119],
          results: [0, 119 - mocks.elapsedTime],
        },
        {
          displayedTimes: [5, 72],
          results: [0, 72 - mocks.elapsedTime],
        },
      ])(
        'should send times (displayed: $displayedTimes, results: $results)',
        async ({ displayedTimes, results }) => {
          const { attributes, arrivalInfo } = toUpdateCase(displayedTimes, [0, 0], '');

          mockApp.getAttributes.mockReturnValue(attributes);
          mockBusService.retrieveArrivalInfo.mockResolvedValue({
            stop: mocks.stop,
            buses: arrivalInfo,
          });

          await handlers.handleUpdate(mocks.ctx);

          return expect(app.sendTimes).toBeCalledWith(mocks.ctx, ...results);
        },
      );

      it.each([
        { displayedTimes: [58, 59] },
        { displayedTimes: [32, 48] },
        { displayedTimes: [5, 11] },
      ])(`should send an error (${MESSAGES.busArrived})`, async ({ displayedTimes }) => {
        const { attributes, arrivalInfo } = toUpdateCase(displayedTimes, [0, 0], '');

        mockApp.getAttributes.mockReturnValue(attributes);
        mockBusService.retrieveArrivalInfo.mockResolvedValue({
          stop: mocks.stop,
          buses: arrivalInfo,
        });

        await handlers.handleUpdate(mocks.ctx);

        expect(app.sendError).toBeCalledWith(mocks.ctx, MESSAGES.busArrived);
      });
    });
  });
});

function getValidUpdateCase(displayedTimes: number[], updated: boolean) {
  const firstBusArrived = displayedTimes[0] < 1;

  if (!updated) {
    const firstTime = displayedTimes[0] - 1 * MINUTE_IN_SECONDS;
    const secondTime = displayedTimes[1] - 1 * MINUTE_IN_SECONDS;
    const results = [Math.max(firstTime, 0), Math.max(secondTime, -1)];

    return toUpdateCase(displayedTimes, displayedTimes, results);
  }

  const firstMinTime = !firstBusArrived
    ? displayedTimes[0] - thresholdTime
    : displayedTimes[1] - thresholdTime;

  const secondMinTime =
    displayedTimes[1] > 0 ? displayedTimes[1] - thresholdTime : firstMinTime + 1;

  const firstTime = random.pickRandomNumber(
    Math.max(firstMinTime, 1),
    firstMinTime + thresholdTime * 2 - 1,
  );

  const secondTime = random.pickRandomNumber(
    Math.max(secondMinTime, 1),
    secondMinTime + thresholdTime * 2 - 1,
  );

  const shortTime = Math.min(firstTime, secondTime);
  const longTime = Math.max(firstTime, secondTime);
  const results = [+!firstBusArrived && shortTime, firstBusArrived ? shortTime : longTime];

  return toUpdateCase(displayedTimes, [shortTime, longTime], results);
}

function toUpdateCase(
  displayedTimes: number[],
  arrivalTimes: number[],
  results: string | number[],
) {
  return {
    results,
    attributes: {
      firstRemainingTime: toRemainingTime(displayedTimes[0]),
      secondRemainingTime: toRemainingTime(displayedTimes[1]),
      statusMessage: '00:00:00 기준',
      notificationButton: 'ready' as app.ButtonStatusType,
    },
    arrivalInfo: [
      { arrivalTime: arrivalTimes[0], ...mocks.baseArrivalInfo },
      ...(arrivalTimes[1] >= 0 ? [{ arrivalTime: arrivalTimes[1], ...mocks.baseArrivalInfo }] : []),
    ],
  };
}

function toRemainingTime(seconds: number) {
  if (seconds > 0) {
    return time.formatTime(seconds) as app.CommonCodeType;
  }

  return !seconds ? MESSAGES.arrival : MESSAGES.none;
}
