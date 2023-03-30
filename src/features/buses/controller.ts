import BusService from './service';

export default class BusController {
  static async retrieveStops(req: Types.BusReq, res: Res, next: Next): Promise<Res | void> {
    const { cityNumber } = req.params;
    const { keyword } = req.query;

    try {
      const results = await BusService.retrieveStops(+cityNumber, keyword);

      return res.wrap(results);
    } catch (err) {
      return next(err);
    }
  }

  static async retrieveNeighborStops(req: Types.BusReq, res: Res, next: Next): Promise<Res | void> {
    const { cityNumber } = req.params;
    const { stopCode } = req.query;

    try {
      const results = await BusService.retrieveNeighborStops(+cityNumber, stopCode);

      return res.wrap(results);
    } catch (err) {
      return next(err);
    }
  }

  static async retrieveRoutes(req: Types.BusReq, res: Res, next: Next): Promise<Res | void> {
    const { cityNumber } = req.params;
    const { stopCode } = req.query;

    try {
      const results = await BusService.retrieveRoutes(+cityNumber, stopCode);

      return res.wrap(results);
    } catch (err) {
      return next(err);
    }
  }
}
