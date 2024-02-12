import fastify from 'fastify';
import { mediaManagers } from './media-managers';

const app = fastify({ logger: true });


app.get('/', async (request, reply) => {
  reply.send({ hello: 'world' });
});


for (const manager of mediaManagers) {
  app.post(`/${manager.name}`, async (request, reply) => {
    const result = await manager.manager(request.body);
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
