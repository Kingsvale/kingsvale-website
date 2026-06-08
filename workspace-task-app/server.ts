import { createServer } from "node:http";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { parse } from "cookie";
import { prisma } from "./src/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "./src/lib/auth-token";
import { setSocketServer } from "./src/lib/realtime";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

await app.prepare();

const httpServer = createServer((req, res) => {
  handler(req, res);
});

const io = new SocketServer(httpServer, {
  path: "/api/socket",
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    credentials: true
  }
});

setSocketServer(io);

io.use(async (socket, nextMiddleware) => {
  try {
    const cookies = parse(socket.request.headers.cookie || "");
    const token = cookies[SESSION_COOKIE];
    if (!token) {
      return nextMiddleware(new Error("Unauthenticated"));
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return nextMiddleware(new Error("Invalid session"));
    }

    socket.data.userId = session.userId;
    socket.data.email = session.email;
    socket.data.joinedWorkspaces = new Set<string>();
    return nextMiddleware();
  } catch {
    return nextMiddleware(new Error("Socket authentication failed"));
  }
});

io.on("connection", (socket) => {
  socket.on("workspace:join", async (workspaceId: string) => {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: socket.data.userId
        }
      }
    });

    if (!membership) {
      socket.emit("workspace:error", { message: "Workspace access denied." });
      return;
    }

    socket.join(`workspace:${workspaceId}`);
    socket.data.joinedWorkspaces.add(workspaceId);

    await prisma.presenceSession.upsert({
      where: {
        userId_workspaceId: {
          userId: socket.data.userId,
          workspaceId
        }
      },
      create: {
        userId: socket.data.userId,
        workspaceId,
        socketId: socket.id,
        online: true,
        lastSeenAt: new Date()
      },
      update: {
        socketId: socket.id,
        online: true,
        lastSeenAt: new Date()
      }
    });

    io.to(`workspace:${workspaceId}`).emit("presence:changed", {
      workspaceId,
      userId: socket.data.userId,
      online: true
    });
  });

  socket.on("workspace:leave", async (workspaceId: string) => {
    socket.leave(`workspace:${workspaceId}`);
    socket.data.joinedWorkspaces.delete(workspaceId);
    await markOffline(socket.data.userId, workspaceId);
  });

  socket.on("disconnect", async () => {
    const joined = socket.data.joinedWorkspaces as Set<string>;
    await Promise.all([...joined].map((workspaceId) => markOffline(socket.data.userId, workspaceId)));
  });
});

async function markOffline(userId: string, workspaceId: string) {
  await prisma.presenceSession.updateMany({
    where: { userId, workspaceId },
    data: { online: false, lastSeenAt: new Date() }
  });

  io.to(`workspace:${workspaceId}`).emit("presence:changed", {
    workspaceId,
    userId,
    online: false
  });
}

httpServer.listen(port, hostname, () => {
  console.log(`TaskForge ready on http://${hostname}:${port}`);
});
