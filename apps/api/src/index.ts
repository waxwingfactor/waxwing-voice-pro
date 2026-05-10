import { buildServer } from "./server.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const server = await buildServer(env);

await server.listen({ port: env.PORT, host: "0.0.0.0" });
server.log.info(`Voice API listening on ${env.PORT}`);
