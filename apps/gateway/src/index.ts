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
	socket.on("disconnect", (reason) => app.log.info({ id: socket.id, reason }, "socket disconnected"));
});

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: "0.0.0.0" }).then(() => {
	app.log.info(`Gateway listening on ${port}`);
});
