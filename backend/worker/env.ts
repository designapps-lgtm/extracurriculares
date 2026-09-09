import { env } from "cloudflare:workers";

// Puebla process.env desde los bindings de Cloudflare Workers. Este módulo
// DEBE importarse antes que cualquier módulo del backend que lea process.env
// en load-time (especialmente src/config), ya que en Workers no existe un
// archivo .env ni process.env poblado al arrancar el módulo.
Object.assign(process.env, env);

// process.env stringifica los valores (un KVNamespace terminaría como
// "[object Object]"), así que el binding de la caché compartida viaja por
// globalThis y no por process.env.
(globalThis as Record<string, unknown>)["__APPSHEET_KV"] = env.APPSHEET_KV;
