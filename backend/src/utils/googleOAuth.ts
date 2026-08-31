import { OAuth2Client } from "google-auth-library";
import { config } from "../config";

// Singleton compartido entre requests: el OAuth2Client cachea internamente los
// certificados públicos de Google (JWKS/PEM) que se usan para verificar los
// ID tokens. Si se crea un cliente nuevo en cada login, el fetch de certs a
// www.googleapis.com se repite en CADA request. En Workers, donde las
// instancias pueden ser efímeras, cachear a nivel de módulo reduce ese costo.
export const googleOAuthClient = new OAuth2Client(config.googleClientId || undefined);
