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

    interface BusRoute {
      code: string;
      name: string;
      type: TagoRouteType;
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

    interface BusArrivalInfo extends BusRoute {
      vehicleType: TagoBusType;
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
