import type { Server as SocketServer } from "socket.io";

type RealtimeEvent =
  | "task:created"
  | "task:updated"
  | "task:moved"
  | "task:commented"
  | "task:archived"
  | "project:created"
  | "workspace:updated"
  | "member:joined"
  | "notification:created"
  | "presence:changed";

const globalForRealtime = globalThis as unknown as {
  taskforgeIo?: SocketServer;
};

export function setSocketServer(io: SocketServer) {
  globalForRealtime.taskforgeIo = io;
}

export function emitWorkspaceEvent(workspaceId: string, event: RealtimeEvent, payload: unknown) {
  const io = globalForRealtime.taskforgeIo;
  if (!io) {
    return;
  }

  io.to(`workspace:${workspaceId}`).emit(event, {
    workspaceId,
    payload,
    at: new Date().toISOString()
  });
}
