import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import { Server } from "socket.io";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true, credentials: true });
await app.register(fastifyJwt, { secret: process.env.JWT_SECRET || "dev-secret" });

app.get("/health", async () => ({ ok: true }));

app.decorate("authz", async (request: any, reply: any) => {
	try {
		await request.jwtVerify();
	} catch (err) {
		return reply.code(401).send({ error: "unauthorized" });
	}
});

const server = app.server;
const io = new Server(server, { path: "/ws", cors: { origin: true, credentials: true } });

io.use((socket, next) => {
	const header = socket.handshake.headers["authorization"];
	const token = (socket.handshake.auth as any)?.token || (typeof header === "string" ? header.replace("Bearer ", "") : undefined);
	if (!token) return next(new Error("unauthorized"));
	try {
		(app as any).jwt.verify(token);
		return next();
	} catch (e) {
		return next(new Error("unauthorized"));
	}
});

io.on("connection", (socket) => {
	app.log.info({ id: socket.id }, "socket connected");

	// Join rooms for a chat
	socket.on("chat:join", async ({ chatId }: { chatId: string }) => {
		if (!chatId) return;
		socket.join(`chat:${chatId}`);
	});

	// Send message event -> proxy to messaging service and fanout
	socket.on("message:send", async (payload: { chatId: string; senderId: string; ciphertext: string; meta: any; clientMessageId: string }) => {
		try {
			const res = await fetch(process.env.MESSAGING_URL || "http://localhost:3003/messages", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});
			const msg = await res.json();
			io.to(`chat:${payload.chatId}`).emit("message:deliver", msg);
			// ack to sender
			socket.emit("message:ack", { clientMessageId: payload.clientMessageId, serverMessageId: msg._id, status: "sent" });
		} catch (e) {
			socket.emit("error", { code: "SEND_FAILED" });
		}
	});

	// Read/Delivered status updates
	socket.on("message:status", async (payload: { messageId: string; userId: string; status: "delivered" | "read" }) => {
		try {
			await fetch(process.env.MESSAGING_URL || "http://localhost:3003/messages/status", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload)
			});
			io.emit("message:status", payload);
		} catch (e) {
			socket.emit("error", { code: "STATUS_FAILED" });
		}
	});

	socket.on("disconnect", (reason) => app.log.info({ id: socket.id, reason }, "socket disconnected"));
});

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: "0.0.0.0" }).then(() => {
	app.log.info(`Gateway listening on ${port}`);
});
