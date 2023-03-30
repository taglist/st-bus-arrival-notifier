declare global {
  namespace Types {
    interface TagoStopParams extends OpenDataParams {
      cityCode: number;
      nodeid?: string;
      nodeNm?: string;
      nodeNo?: number;
    }

    interface TagoRouteParams extends OpenDataParams {
      cityCode: number;
      routeId?: string;
    }

    interface TagoResponse<T> {
      response: {
        header: {
          resultCode: string;
          resultMsg: string;
        };
        body: {
          totalCount: number;
          numOfRows: number;
          pageNo: number;
          items:
            | {
                item: T | T[];
              }
            | '';
        };
      };
    }

    interface TagoStop {
      nodeid: string;
      nodenm: string;
      gpslati: number;
      gpslong: number;
      nodeno?: number;
    }

    type TagoStops = TagoResponse<TagoStop>;

    type TagoRouteType = '공항버스' | '좌석버스' | '일반버스' | '지선버스' | '마을버스';

    interface TagoRoute {
      routeid: string;
      routeno: string | number;
      routetp: TagoRouteType;
      startnodenm: string;
      endnodenm: string;
      startvehicletime?: string;
      endvehicletime?: string;
    }

    type TagoRoutes = TagoResponse<TagoRoute>;

    interface TagoSequentialStop extends TagoStop {
      nodeord: number;
      routeid: string;
      updowncd?: number;
    }

    type TagoSequentialStops = TagoResponse<TagoSequentialStop>;

    interface TagoBusLocation {
      routenm: string;
      routetp: TagoRouteType;
      vehicleno: string;
      nodeid: string;
      nodenm: string;
      nodeord: number;
      gpslati?: number;
      gpslong?: number;
    }

    type TagoBusLocations = TagoResponse<TagoBusLocation>;

    type TagoBusType = '일반버스' | '저상버스';

    interface TagoArrivalInfo {
      arrprevstationcnt: number;
      arrtime: number;
      routeid: string;
      routeno: string | number;
      routetp: TagoRouteType;
      vehicletp: TagoBusType;
      nodeid: string;
      nodenm: string;
    }

    type TagoBusArrivalInfo = TagoResponse<TagoArrivalInfo>;
  }
}

interface OpenDataParams {
  numOfRows?: number;
  pageNo?: number;
}

export {};
