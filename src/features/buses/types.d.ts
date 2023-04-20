declare global {
  namespace Types {
    interface StopInfo {
      code: string;
      name: string;
    }

    interface BusStop extends StopInfo {
      coordinates: Coordinates;
      number?: number;
    }

    type BusRouteType =
      | '공항'
      | '마을'
      | '간선'
      | '지선'
      | '순환'
      | '광역'
      | '인천'
      | '경기'
      | '폐지'
      | '공용'
      // TAGO bus
      | '좌석'
      | '일반';

    interface BusRoute {
      code: string;
      name: string;
      type: BusRouteType;
    }

    interface SequentialStop extends BusStop {
      order: number;
      routeCode: string;
    }

    interface BusStopInfo extends Omit<BusStop, 'number' | 'coordinates'> {
      order: number;
      coordinates?: Coordinates;
    }

    interface BusRouteInfo extends Omit<BusRoute, 'code'> {
      vehicleNumber: string;
    }

    interface BusLocation {
      stop: BusStopInfo;
      route: BusRouteInfo;
    }

    type BusVehicleType = '일반버스' | '저상버스' | '굴절버스' | '경기도버스';

    interface BusArrivalInfo extends BusRoute {
      vehicleType: BusVehicleType;
      remainingStopCount: number;
      arrivalTime: number;
    }

    interface ArrivalInfo {
      bus: BusArrivalInfo;
      stop: StopInfo;
    }

    interface StopArrivalInfo {
      stop: StopInfo;
      buses: BusArrivalInfo[];
    }
  }
}

declare global {
  namespace Types {
    interface BusParams extends Params {
      cityNumber: string;
    }

    interface BusQuery extends Query {
      keyword: string;
      stopCode: string;
    }

    type BusReq = Req<BusParams, BusQuery>;
  }
}

export {};
