import Fastify from 'fastify';
import { MongoClient, ObjectId } from 'mongodb';
import { z } from 'zod';

const app = Fastify({ logger: true });

const mongo = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017');
await mongo.connect();
const db = mongo.db(process.env.MONGO_DB || 'chat');
const chats = db.collection('chats');
const messages = db.collection('messages');
const statuses = db.collection('message_statuses');

const CreateChatSchema = z.object({ type: z.enum(['direct','group']), participants: z.array(z.string()).optional(), title: z.string().optional() });
const SendMessageSchema = z.object({ chatId: z.string(), senderId: z.string(), ciphertext: z.string(), meta: z.any(), clientMessageId: z.string() });
const StatusSchema = z.object({ messageId: z.string(), userId: z.string(), status: z.enum(['delivered','read']) });

app.post('/chats', async (req, reply) => {
  const body = CreateChatSchema.parse(req.body);
  const chat = { type: body.type, title: body.title, participants: body.participants || [], createdAt: new Date() };
  const res = await chats.insertOne(chat as any);
  return { _id: res.insertedId, ...chat };
});

app.get('/chats/:chatId/messages', async (req) => {
  const chatId = (req.params as any).chatId;
  const list = await messages.find({ chatId }).sort({ _id: -1 }).limit(50).toArray();
  return { messages: list };
});

app.post('/messages', async (req, reply) => {
  const body = SendMessageSchema.parse(req.body);
  const msg = { chatId: body.chatId, senderId: body.senderId, ciphertext: body.ciphertext, meta: body.meta, clientMessageId: body.clientMessageId, createdAt: new Date() } as any;
  const res = await messages.insertOne(msg);
  return { _id: res.insertedId.toString(), ...msg };
});

app.post('/messages/status', async (req) => {
  const body = StatusSchema.parse(req.body);
  const messageObjectId = new ObjectId(body.messageId);
  await statuses.updateOne({ messageId: messageObjectId, userId: body.userId }, { $set: { [body.status === 'read' ? 'readAt' : 'deliveredAt']: new Date() } }, { upsert: true });
  return { ok: true };
});

const port = Number(process.env.PORT || 3003);
app.listen({ port, host: '0.0.0.0' }).then(() => app.log.info(`Messaging service listening on ${port}`));