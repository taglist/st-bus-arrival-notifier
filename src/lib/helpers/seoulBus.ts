/* eslint-disable no-console */
import * as errors from '@taglist/errors';
import type { AxiosResponse } from 'axios';
import { type } from 'ryutils';

import { seoulBus } from '../clients';

// https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15000303
export async function fetchStops(keyword: string): Promise<Types.BusStop[]> {
  const path = '/stationinfo/getStationByName';

  try {
    const { data } = await seoulBus.get<Types.SeoulStops>(path, {
      params: { stSrch: keyword },
    });

    const { itemList } = data.msgBody;

    return itemList ? itemList.slice(0, 10).map(convertStop) : [];
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }

    ensureNoXmlData(err);

    throw new errors.BadRequest('Unknown');
  }
}

function convertStop(stop: Types.SeoulStop): Types.BusStop {
  return {
    code: stop.arsId,
    name: stop.stNm,
    number: +stop.arsId,
    coordinates: [+stop.tmX, +stop.tmY],
  };
}

// https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15000303
export async function fetchRoutesByStop(stopCode: string): Promise<Types.BusRoute[]> {
  const path = 'stationinfo/getRouteByStation';

  try {
    const { data } = await seoulBus.get<Types.SeoulRoutes>(path, {
      params: { arsId: stopCode },
    });

    const { itemList } = data.msgBody;

    return itemList ? itemList.map(convertRoute) : [];
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }

    ensureNoXmlData(err);

    throw new errors.BadRequest('Unknown');
  }
}

function convertRoute(route: Types.SeoulRoute): Types.BusRoute {
  return {
    code: route.busRouteId,
    name: route.busRouteNm,
    type: toRouteType(+route.busRouteType - 1),
  };
}

const routeTypes = [
  '공항',
  '마을',
  '간선',
  '지선',
  '순환',
  '광역',
  '인천',
  '경기',
  '폐지',
  '공용',
] as const;

function toRouteType(typeNumber: number) {
  return routeTypes[typeNumber] as Types.BusRouteType;
}

// https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15000193
export async function fetchStopsByRoute(routeCode: string): Promise<Types.SequentialStop[]> {
  const path = 'busRouteInfo/getStaionByRoute';

  try {
    const { data } = await seoulBus.get<Types.SeoulSequentialStops>(path, {
      params: { busRouteId: routeCode },
    });

    const { itemList } = data.msgBody;

    return itemList ? itemList.map(convertSequentialStop) : [];
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }

    ensureNoXmlData(err);

    throw new errors.BadRequest('Unknown');
  }
}

function convertSequentialStop(stop: Types.SeoulSequentialStop): Types.SequentialStop {
  return {
    code: stop.arsId,
    name: stop.stationNm,
    number: +stop.arsId,
    coordinates: [+stop.gpsX, +stop.gpsY],
    order: +stop.seq,
    routeCode: stop.busRouteId,
  };
}

// https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15000303
export async function fetchArrivalInfoByStop(stopCode: string): Promise<Types.ArrivalInfo[]> {
  const path = 'stationinfo/getStationByUid';

  try {
    const { data } = await seoulBus.get<Types.SeoulBusArrivalInfo>(path, {
      params: { arsId: stopCode },
    });

    const { itemList } = data.msgBody;

    if (!itemList) {
      return [];
    }

    const arrivalInfo = itemList.filter(elem => elem.traTime1 !== '0').map(convertArrivalInfo);

    return ([] as Types.ArrivalInfo[]).concat(...arrivalInfo);
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }

    ensureNoXmlData(err);

    throw new errors.BadRequest('Unknown');
  }
}

function convertArrivalInfo(arrivalInfo: Types.SeoulArrivalInfo): Types.ArrivalInfo[] {
  const stop = {
    code: arrivalInfo.arsId,
    name: arrivalInfo.stNm,
  };

  const baseBus = {
    code: arrivalInfo.busRouteId,
    name: arrivalInfo.rtNm,
    type: toRouteType(+arrivalInfo.routeType - 1),
  };

  const currentOrder = +arrivalInfo.staOrd;

  const results = [
    {
      stop,
      bus: {
        ...baseBus,
        vehicleType: toVehicleType(+arrivalInfo.busType1),
        remainingStopCount: currentOrder - +arrivalInfo.sectOrd1,
        arrivalTime: +arrivalInfo.traTime1,
      },
    },
  ];

  if (arrivalInfo.traTime2 !== '0') {
    results.push({
      stop,
      bus: {
        ...baseBus,
        vehicleType: toVehicleType(+arrivalInfo.busType2),
        remainingStopCount: currentOrder - +arrivalInfo.sectOrd2,
        arrivalTime: +arrivalInfo.traTime2,
      },
    });
  }

  return results;
}

const vehicleTypes = ['일반버스', '저상버스', '굴절버스', '경기도버스'] as const;

function toVehicleType(typeNumber: number) {
  return vehicleTypes[typeNumber] as Types.BusVehicleType;
}

function ensureNoXmlData(val: unknown) {
  if (type.isObject(val) && Object.hasOwn(val, 'data')) {
    console.error(val);

    const { data } = val as AxiosResponse;

    if (data.includes('SERVICE_KEY')) {
      throw new errors.Unauthorized('Service key not registered');
    }
    if (data.includes('SERVICE')) {
      throw new errors.Forbidden('Service access denied');
    }

    throw new errors.ServiceUnavailable('Seoul bus');
  }
}
