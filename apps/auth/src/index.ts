import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });
await app.register(fastifyJwt, { secret: process.env.JWT_SECRET || 'dev-secret' });

const mongo = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017');
await mongo.connect();
const db = mongo.db(process.env.MONGO_DB || 'chat');
const users = db.collection('users');

const RegisterSchema = z.object({ phoneOrEmail: z.string().min(3), password: z.string().min(6) });
const LoginSchema = RegisterSchema;

app.post('/auth/register', async (req, reply) => {
  const body = RegisterSchema.parse(req.body);
  const existing = await users.findOne({ phoneOrEmail: body.phoneOrEmail });
  if (existing) return reply.code(409).send({ error: 'exists' });
  const hash = await bcrypt.hash(body.password, 10);
  const user = { phoneOrEmail: body.phoneOrEmail, passwordHash: hash, createdAt: new Date() } as any;
  const result = await users.insertOne(user);
  const userId = result.insertedId.toString();
  const token = app.jwt.sign({ sub: userId, phoneOrEmail: user.phoneOrEmail }, { expiresIn: '15m' });
  const refresh = app.jwt.sign({ sub: userId, type: 'refresh' }, { expiresIn: '7d' });
  return { token, refresh, userId };
});

app.post('/auth/login', async (req, reply) => {
  const body = LoginSchema.parse(req.body);
  const user = await users.findOne({ phoneOrEmail: body.phoneOrEmail });
  if (!user) return reply.code(401).send({ error: 'invalid' });
  const ok = await bcrypt.compare(body.password, (user as any).passwordHash);
  if (!ok) return reply.code(401).send({ error: 'invalid' });
  const userId = (user as any)._id.toString();
  const token = app.jwt.sign({ sub: userId, phoneOrEmail: (user as any).phoneOrEmail }, { expiresIn: '15m' });
  const refresh = app.jwt.sign({ sub: userId, type: 'refresh' }, { expiresIn: '7d' });
  return { token, refresh, userId };
});

const port = Number(process.env.PORT || 3001);
app.listen({ port, host: '0.0.0.0' }).then(() => app.log.info(`Auth listening on ${port}`));