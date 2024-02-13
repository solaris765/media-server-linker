export interface TypedResponse<T> extends Response {
  json<T>(): Promise<T>;
}

export interface Logger {
  info(message: string): void;
  error(message: string): void;
}
export interface MediaManagerOptions {
  logger: Logger;
}
export abstract class MediaManager<PayloadBase> {
  protected logger: Logger;
  constructor(options: { logger: Logger }) {
    this.logger = options.logger;
  }
  abstract processWebhook(body: PayloadBase): Promise<boolean> | boolean;
}
export interface MediaManagerConstructor {
  new (options: MediaManagerOptions): MediaManager<unknown>;
}


