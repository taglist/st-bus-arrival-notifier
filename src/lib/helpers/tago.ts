/* eslint-disable no-console */
import * as errors from '@taglist/errors';
import type { AxiosResponse } from 'axios';
import { type } from 'ryutils';

import { tago } from '../clients';

// https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15098534
export async function fetchStops(params: Types.TagoStopParams): Promise<Types.BusStop[]> {
  const path = '/BusSttnInfoInqireService/getSttnNoList';

  try {
    const { data } = await tago.get<Types.TagoStops>(path, { params });
    const { items } = data.response.body;

    if (items === '') {
      return [];
    }

    return Array.isArray(items.item) ? items.item.map(convertStop) : [convertStop(items.item)];
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }

    ensureNoXmlData(err);

    throw new errors.BadRequest('Unknown');
  }
}

function convertStop(stop: Types.TagoStop): Types.BusStop {
  return {
    code: stop.nodeid,
    name: stop.nodenm,
    number: stop.nodeno,
    coordinates: [stop.gpslong, stop.gpslati],
  };
}

// https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15098534
export async function fetchRoutesByStop(params: Types.TagoStopParams): Promise<Types.BusRoute[]> {
  const path = 'BusSttnInfoInqireService/getSttnThrghRouteList';

  try {
    const { data } = await tago.get<Types.TagoRoutes>(path, { params });
    const { items } = data.response.body;

    if (items === '') {
      return [];
    }

    return Array.isArray(items.item) ? items.item.map(convertRoute) : [convertRoute(items.item)];
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }

    ensureNoXmlData(err);

    throw new errors.BadRequest('Unknown');
  }
}

function convertRoute(route: Types.TagoRoute): Types.BusRoute {
  return {
    code: route.routeid,
    name: `${route.routeno}`,
    type: route.routetp,
  };
}

// https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15098529
export async function fetchStopsByRoute(
  params: Types.TagoRouteParams,
): Promise<Types.SequentialStop[]> {
  const path = 'BusRouteInfoInqireService/getRouteAcctoThrghSttnList';

  try {
    const { data } = await tago.get<Types.TagoSequentialStops>(path, {
      params: { ...params, numOfRows: 200 },
    });

    const { items } = data.response.body;

    if (items === '') {
      return [];
    }

    return Array.isArray(items.item)
      ? items.item.map(convertSequentialStop)
      : [convertSequentialStop(items.item)];
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }

    ensureNoXmlData(err);

    throw new errors.BadRequest('Unknown');
  }
}

function convertSequentialStop(stop: Types.TagoSequentialStop): Types.SequentialStop {
  return {
    ...convertStop(stop),
    order: stop.nodeord,
    routeCode: stop.routeid,
  };
}

// https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15098533
export async function fetchBusLocationsByRoute(
  params: Types.TagoRouteParams,
): Promise<Types.BusLocation[]> {
  const path = 'BusLcInfoInqireService/getRouteAcctoBusLcList';

  try {
    const { data } = await tago.get<Types.TagoBusLocations>(path, {
      params: { ...params, numOfRows: 50 },
    });

    const { items } = data.response.body;

    if (items === '') {
      return [];
    }

    return Array.isArray(items.item)
      ? items.item.map(convertBusLocation)
      : [convertBusLocation(items.item)];
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }

    ensureNoXmlData(err);

    throw new errors.BadRequest('Unknown');
  }
}

function convertBusLocation(busLocation: Types.TagoBusLocation): Types.BusLocation {
  let coordinates: Types.Coordinates | undefined;

  if (busLocation.gpslong && busLocation.gpslati) {
    coordinates = [busLocation.gpslong, busLocation.gpslati];
  }

  return {
    stop: {
      coordinates,
      code: busLocation.nodeid,
      name: busLocation.nodenm,
      order: busLocation.nodeord,
    },
    route: {
      name: busLocation.routenm,
      type: busLocation.routetp,
      vehicleNumber: busLocation.vehicleno,
    },
  };
}

// https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15098530
export async function fetchArrivalInfoByStop(
  params: Types.TagoStopParams,
): Promise<Types.ArrivalInfo[]> {
  const path = 'ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList';

  try {
    const { data } = await tago.get<Types.TagoBusArrivalInfo>(path, {
      params: { ...params, numOfRows: 50 },
    });

    const { items } = data.response.body;

    if (items === '') {
      return [];
    }

    return Array.isArray(items.item)
      ? items.item.map(convertArrivalInfo)
      : [convertArrivalInfo(items.item)];
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }

    ensureNoXmlData(err);

    throw new errors.BadRequest('Unknown');
  }
}

function convertArrivalInfo(arrivalInfo: Types.TagoArrivalInfo): Types.ArrivalInfo {
  return {
    bus: {
      code: arrivalInfo.routeid,
      name: `${arrivalInfo.routeno}`,
      type: arrivalInfo.routetp,
      vehicleType: arrivalInfo.vehicletp,
      remainingStopCount: arrivalInfo.arrprevstationcnt,
      arrivalTime: arrivalInfo.arrtime,
    },
    stop: {
      code: arrivalInfo.nodeid,
      name: arrivalInfo.nodenm,
    },
  };
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

    throw new errors.ServiceUnavailable('Tago');
  }
}
