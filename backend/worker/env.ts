import { env } from "cloudflare:workers";

// Puebla process.env desde los bindings de Cloudflare Workers. Este módulo
// DEBE importarse antes que cualquier módulo del backend que lea process.env
// en load-time (especialmente src/config), ya que en Workers no existe un
// archivo .env ni process.env poblado al arrancar el módulo.
Object.assign(process.env, env);
