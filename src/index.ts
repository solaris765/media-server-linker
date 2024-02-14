import fs from 'fs';
import fastify from 'fastify';
import { mediaManagers } from './media-managers';
import curlString from 'curl-string';

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
    if (request.headers['is-copy'] !== 'true') {
      const curl = curlString(request.url, {
        method: request.method,
        headers: {
          'content-type': request.headers['content-type'],
          accept: request.headers.accept
        }
      });

      fs.appendFile('log.txt', curl + '\n\n', (err) => {
        if (err) {
          request.log.error('Error writing to log file');
        }
      });
    }

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
