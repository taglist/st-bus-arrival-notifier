declare global {
  namespace Express {
    interface Request {
      client: object;
    }

    interface Response {
      wrap(data: ResponseData, code?: number, error?: Error): Res;
    }
  }
}

type ResponseData = object | object[] | null;

export {};
