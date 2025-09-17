import Fastify from 'fastify';
import cors from '@fastify/cors';
import { MongoClient } from 'mongodb';
import { z } from 'zod';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });

const mongo = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017');
await mongo.connect();
const db = mongo.db(process.env.MONGO_DB || 'chat');
const profiles = db.collection('profiles');

const ProfileSchema = z.object({
  displayName: z.string().min(1),
  about: z.string().max(160).optional(),
  privacy: z.object({
    avatarVisibility: z.enum(['everyone','contacts','nobody','custom']).default('everyone'),
    readReceiptsEnabled: z.boolean().default(true)
  }).partial().default({})
});

app.get('/profiles/:userId', async (req, reply) => {
  const userId = (req.params as any).userId;
  const profile = await profiles.findOne({ userId });
  if (!profile) return reply.code(404).send({ error: 'not_found' });
  return profile;
});

app.patch('/profiles/:userId', async (req, reply) => {
  const userId = (req.params as any).userId;
  const body = ProfileSchema.partial().parse(req.body || {});
  await profiles.updateOne({ userId }, { $set: { ...body, updatedAt: new Date() } }, { upsert: true });
  const updated = await profiles.findOne({ userId });
  return updated;
});

const port = Number(process.env.PORT || 3002);
app.listen({ port, host: '0.0.0.0' }).then(() => app.log.info(`User service listening on ${port}`));