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

declare global {
  namespace Types {
    interface SeoulStopParams {
      stSrch: string;
    }

    interface SeoulBusResponse<T> {
      msgHeader: {
        headerCd: string;
        headerMsg: string;
        itemCount: 0;
      };
      msgBody: {
        itemList: T[] | null;
      };
      comMsgHeader: {
        errMsg: null;
        responseMsgID: null;
        responseTime: null;
        requestMsgID: null;
        successYN: null;
        returnCode: null;
      };
    }

    interface SeoulStop {
      stId: string;
      stNm: string;
      tmX: string;
      tmY: string;
      posX: string;
      posY: string;
      arsId: string;
    }

    type SeoulStops = SeoulBusResponse<SeoulStop>;

    type SeoulRouteType =
      | '공항'
      | '마을'
      | '간선'
      | '지선'
      | '순환'
      | '광역'
      | '인천'
      | '경기'
      | '폐지'
      | '공용';

    interface SeoulRoute {
      busRouteId: string;
      busRouteNm: string;
      busRouteAbrv: string;
      length: string;
      busRouteType: string;
      stBegin: string;
      stEnd: string;
      term: string;
      nextBus: '10';
      firstBusTm: string;
      lastBusTm: string;
      firstBusTmLow: string;
      lastBusTmLow: string;
    }

    type SeoulRoutes = SeoulBusResponse<SeoulRoute>;

    interface SeoulSequentialStop
      extends TagoStop,
        Pick<SeoulRoute, 'busRouteId' | 'busRouteNm' | 'busRouteAbrv'> {
      seq: string;
      section: string;
      station: string;
      arsId: string;
      stationNm: string;
      gpsX: string;
      gpsY: string;
      posX: string;
      posY: string;
      fullSectDist: string;
      direction: string;
      stationNo: string;
      routeType: string;
      beginTm: string;
      lastTm: string;
      trnstnid: string;
      sectSpd: string;
      transYn: string;
    }

    type SeoulSequentialStops = SeoulBusResponse<SeoulSequentialStop>;

    interface SeoulArrivalInfo {
      stId: string;
      stNm: string;
      arsId: string;
      busRouteId: string;
      rtNm: string;
      busRouteAbrv: string;
      sectNm: string;
      gpsX: string;
      gpsY: string;
      posX: string;
      posY: string;
      stationTp: string;
      firstTm: string;
      lastTm: string;
      term: string;
      routeType: string;
      nextBus: string;
      staOrd: string;
      vehId1: string;
      plainNo1: string | null;
      sectOrd1: string;
      stationNm1: string;
      traTime1: string;
      traSpd1: string;
      isArrive1: string;
      repTm1: string;
      isLast1: string;
      busType1: string;
      vehId2: string;
      plainNo2: string | null;
      sectOrd2: string;
      stationNm2: string;
      traTime2: string;
      traSpd2: string;
      isArrive2: string;
      repTm2: string | null;
      isLast2: string;
      busType2: string;
      adirection: string;
      arrmsg1: string;
      arrmsg2: string;
      arrmsgSec1: string;
      arrmsgSec2: string;
      nxtStn: string;
      rerdieDiv1: string;
      rerdieDiv2: string;
      rerideNum1: string;
      rerideNum2: string;
      isFullFlag1: string;
      isFullFlag2: string;
      deTourAt: string;
      congestion: string;
    }

    type SeoulBusArrivalInfo = SeoulBusResponse<SeoulArrivalInfo>;
  }
}

export {};
