export default function responseWrapper(_req: Req, res: Res, next: Next): void {
  res.wrap = (data, code = 200, error?) => {
    const body = Array.isArray(data) ? { results: data } : data ?? {};

    if (code >= 400) {
      Object.assign(body, error && { error: error.name, message: error.message });
    }

    return res.status(code).json(body);
  };

  next();
}
