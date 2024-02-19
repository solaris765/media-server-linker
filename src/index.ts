import fastify from 'fastify';
import { getMediaManagers } from './media-managers';
import { saveCurlToFile } from './util/curl';
import SonarrHandler from './media-managers/sonarr';
import { cleanupMediaServers } from './media-servers';

// catch signals and properly close the server
process.on('SIGINT', async () => {
  console.log('Caught interrupt signal');
  await app.close();
  process.exit();
});

const app = fastify({ logger: true });


app.get('/', async (request, reply) => {
  reply.send({ hello: 'world' });
});

const mediaManagers = await getMediaManagers();
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

interface TVQuery {
  id: string;
  quick: 'true' | 'false';
}
app.get<{Querystring:TVQuery}>('/tv', async (request, reply) => {
  const mediaMng = new SonarrHandler({
    logger: request.log
  });

  if (request.query.id) {
    const result = await mediaMng.processEpisodeById(Number.parseInt(request.query.id));
    reply.send(result);
    return;
  } else {
    const result = await mediaMng.bulkProcess(request.query.quick === 'true');
    reply.send(result);
  }
});

app.get('/cleanup', async (request, reply) => {
  await cleanupMediaServers(request.log);

  reply.send({ success: true });
});

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
