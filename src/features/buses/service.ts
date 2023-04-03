import * as errors from '@taglist/errors';
import { string, type } from 'ryutils';

import { tago } from '@/lib/helpers';

export default class BusService {
  static retrieveStops(cityNumber: number, keyword: string): Promise<Types.BusStop[]> {
    const paramName = string.isNumeric(keyword) ? 'nodeNo' : 'nodeNm';
    const params = {
      cityCode: cityNumber,
      [paramName]: paramName === 'nodeNo' ? +keyword : keyword,
    };

    return tago.fetchStops(params);
  }

  static async retrieveRoutes(cityNumber: number, stopCode: string): Promise<Types.BusRoute[]> {
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
      number => number >= 0,
    );

    const results = [] as Types.BusStopInfo[];

    sequentialStops.every(stop => {
      if (sequenceNumbers.includes(stop.order)) {
        results.push(stop);

        if (results.length > 2) {
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
}
