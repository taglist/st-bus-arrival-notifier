import * as errors from '@taglist/errors';
import { string, type } from 'ryutils';

import { seoulBus, tago } from '@/lib/helpers';

const seoulNumber = 99999;

export default class BusService {
  static retrieveStops(cityNumber: number, keyword: string): Promise<Types.BusStop[]> {
    if (cityNumber === seoulNumber) {
      return this.retrieveSeoulStops(keyword);
    }

    const paramName = string.isNumeric(keyword) ? 'nodeNo' : 'nodeNm';
    const params = {
      cityCode: cityNumber,
      [paramName]: paramName === 'nodeNo' ? +keyword : keyword,
    };

    return tago.fetchStops(params);
  }

  static async retrieveRoutes(cityNumber: number, stopCode: string): Promise<Types.BusRoute[]> {
    if (cityNumber === seoulNumber) {
      return this.retrieveSeoulRoutes(stopCode);
    }

    const stopParams = {
      cityCode: cityNumber,
      nodeid: stopCode,
    };

    const routes = await tago.fetchRoutesByStop(stopParams);

    if (!routes.length) {
      throw new errors.Conflict('Invalid stop code');
    }

    return routes;
  }

  static async retrieveNeighborStops(
    cityNumber: number,
    stopCode: string,
  ): Promise<Types.BusStopInfo[]> {
    if (cityNumber === seoulNumber) {
      return this.retrieveSeoulNeighborStops(stopCode);
    }

    const routes = await this.retrieveRoutes(cityNumber, stopCode);
    const routeParams = {
      cityCode: cityNumber,
      routeId: routes[0].code,
    };

    const sequentialStops = await tago.fetchStopsByRoute(routeParams);
    const middleNumber = sequentialStops.find(stop => stop.code === stopCode)?.order;

    if (type.isNullish(middleNumber)) {
      throw new errors.Conflict('Invalid data');
    }

    const sequenceNumbers = [middleNumber - 1, middleNumber, middleNumber + 1].filter(
      number => number > 0,
    );

    const results = [] as Types.BusStopInfo[];

    sequentialStops
      .sort((a, b) => a.order - b.order)
      .every(stop => {
        if (sequenceNumbers.includes(stop.order)) {
          results.push(stop);

          if (results.length >= sequenceNumbers.length) {
            return false;
          }
        }

        return true;
      });

    return results;
  }

  static async retrieveArrivalInfo(
    cityNumber: number,
    stopCode: string,
  ): Promise<Types.StopArrivalInfo> {
    if (cityNumber === seoulNumber) {
      return this.retrieveSeoulArrivalInfo(stopCode);
    }

    const params = {
      cityCode: cityNumber,
      nodeId: stopCode,
    };

    const arrivalInfo = await tago.fetchArrivalInfoByStop(params);

    if (!arrivalInfo.length) {
      return {} as Types.StopArrivalInfo;
    }

    return {
      stop: arrivalInfo[0].stop,
      buses: arrivalInfo.map(info => info.bus),
    };
  }

  static async retrieveBusLocations(
    cityNumber: number,
    routeCode: string,
  ): Promise<Types.BusStopInfo[]> {
    const params = {
      cityCode: cityNumber,
      routeId: routeCode,
    };

    const busLocations = await tago.fetchBusLocationsByRoute(params);

    return busLocations.map(location => location.stop);
  }

  private static retrieveSeoulStops(keyword: string) {
    return seoulBus.fetchStops(keyword);
  }

  private static async retrieveSeoulRoutes(stopCode: string) {
    const routes = await seoulBus.fetchRoutesByStop(stopCode);

    if (!routes.length) {
      throw new errors.Conflict('Invalid stop code');
    }

    return routes;
  }

  private static async retrieveSeoulNeighborStops(stopCode: string) {
    const routes = await this.retrieveSeoulRoutes(stopCode);
    const sequentialStops = await seoulBus.fetchStopsByRoute(routes[0].code);
    const middleNumber = sequentialStops.find(stop => stop.code === stopCode)?.order;

    if (type.isNullish(middleNumber)) {
      throw new errors.Conflict('Invalid data');
    }

    const sequenceNumbers = [middleNumber - 1, middleNumber, middleNumber + 1].filter(
      number => number > 0,
    );

    const results = [] as Types.BusStopInfo[];

    sequentialStops
      .sort((a, b) => a.order - b.order)
      .every(stop => {
        if (sequenceNumbers.includes(stop.order)) {
          results.push(stop);

          if (results.length >= sequenceNumbers.length) {
            return false;
          }
        }

        return true;
      });

    return results;
  }

  private static async retrieveSeoulArrivalInfo(stopCode: string) {
    const arrivalInfo = await seoulBus.fetchArrivalInfoByStop(stopCode);

    if (!arrivalInfo.length) {
      return {} as Types.StopArrivalInfo;
    }

    return {
      stop: arrivalInfo[0].stop,
      buses: arrivalInfo.map(info => info.bus),
    };
  }
}
