"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

const workspaceEvents = [
  "task:created",
  "task:updated",
  "task:moved",
  "task:commented",
  "task:archived",
  "project:created",
  "workspace:updated",
  "member:joined",
  "notification:created",
  "presence:changed"
] as const;

export function useWorkspaceSocket(workspaceId: string, onWorkspaceEvent: (event: string) => void) {
  const callbackRef = useRef(onWorkspaceEvent);
  callbackRef.current = onWorkspaceEvent;

  useEffect(() => {
    const socket: Socket = io({
      path: "/api/socket",
      withCredentials: true,
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {
      socket.emit("workspace:join", workspaceId);
    });

    workspaceEvents.forEach((eventName) => {
      socket.on(eventName, () => callbackRef.current(eventName));
    });

    return () => {
      socket.emit("workspace:leave", workspaceId);
      socket.disconnect();
    };
  }, [workspaceId]);
}
