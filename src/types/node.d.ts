declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: EnvType;
    readonly APP_PORT: string;
    readonly OPEN_API_KEY: string;
    readonly BUS_MIN_TIME: string;
  }
}

type EnvType = 'development' | 'test' | 'production';
