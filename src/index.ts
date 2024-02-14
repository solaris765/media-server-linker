import fs from 'fs';
import fastify from 'fastify';
import { mediaManagers } from './media-managers';
import curlString from 'curl-string';
import { saveCurlToFile } from './util/curl';

const app = fastify({ logger: true });


app.get('/', async (request, reply) => {
  reply.send({ hello: 'world' });
});

for (const manager of mediaManagers) {
  app.post(`/${manager.name}`, async (request, reply) => {
    const handler = new manager.handler({
      logger: request.log
    });

    // Log equivalent curl command to log
    saveCurlToFile({
      url: `${request.protocol}://${request.hostname}${request.url}`,
      init: {
        method: request.method,
        headers: request.headers,
        body: request.body as any
      }
    }, `${manager.name}-webhook.log`);


    const result = await handler.processWebhook(request.body);

    request.log.info(JSON.stringify(result));
    reply.send();
  });
}

let PORT = 3000;
try {
  if (process.env.PORT)
    PORT = parseInt(process.env.PORT, 10);
} catch (e) {
  console.error(e);
}
app.listen({
  port: PORT,
  host: '0.0.0.0',
  listenTextResolver: (address) => {
    return `Listening on ${address}`;
  }
});
