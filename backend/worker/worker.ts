import "./env";
import { httpServerHandler } from "cloudflare:node";
import app from "../src/app";
import { config } from "../src/config";
import { prewarmSharedCache } from "../src/modules/appsheet/appsheet.repository";

app.listen(config.port);

const expressHandler = httpServerHandler({ port: config.port });

export default {
  ...expressHandler,
  async scheduled(): Promise<void> {
    // Precarga en la caché compartida (KV) las tablas más leídas. Cada isolate
    // frío que reciba tráfico encontrará ahí el dato y no pegará a AppSheet
    // (los 429 del API se vuelven 503 en el errorHandler).
    await prewarmSharedCache();
  },
};
