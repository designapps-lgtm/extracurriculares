import "./env";
import { httpServerHandler } from "cloudflare:node";
import app from "../src/app";
import { config } from "../src/config";

app.listen(config.port);

const expressHandler = httpServerHandler({ port: config.port });

export default {
  ...expressHandler,
  async scheduled(): Promise<void> {
    // La aplicación consume AppSheet en vivo; no existe una réplica SQL que sincronizar.
    console.log("[AppSheet] Sincronización omitida: AppSheet es la fuente de verdad en vivo");
  },
};
