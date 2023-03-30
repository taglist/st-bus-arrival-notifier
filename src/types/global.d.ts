/* eslint-disable @typescript-eslint/no-explicit-any */
import * as core from 'express-serve-static-core';

import * as express from 'express';

declare global {
  type Params = core.ParamsDictionary;

  type Query = core.Query;

  type Req<
    ReqParams extends Params = Params,
    ReqQuery extends Query = Query,
    ReqBody extends object = object,
  > = express.Request<ReqParams, any, ReqBody, ReqQuery>;

  type Res = express.Response;

  type Next = express.NextFunction;
}
