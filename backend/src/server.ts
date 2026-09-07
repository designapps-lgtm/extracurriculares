import app from "./app";
import { config } from "./config";

app.listen(config.port, () => {
  console.log(`[Backend] Server running on port ${config.port}`);
  console.log("[AppSheet] Fuente de datos en vivo; no se programan sincronizaciones periódicas");
});
