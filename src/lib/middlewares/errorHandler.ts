import { Error, Forbidden, ValidationError } from '@taglist/errors';

function clientErrorHandler(err: Error, _req: Req, res: Res, next: Next): Res | void {
  const { code } = err;

  if (typeof code === 'string') {
    const error = new Forbidden('Invalid or missing CSRF token');

    return res.wrap(null, error.code, error);
  }
  if (err instanceof ValidationError) {
    return res.wrap(null, code, err);
  }

  return next(err);
}

function serverErrorHandler(err: Error, _req: Req, res: Res, _next: Next): Res {
  const { data = null, code = 500 } = err;

  return res.wrap(data, code, err);
}

export default [clientErrorHandler, serverErrorHandler];
