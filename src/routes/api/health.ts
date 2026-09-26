import { createFileRoute } from "@tanstack/react-router";
import { cinemaHealth } from "@/lib/cinema/stream.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => cinemaHealth(),
    },
  },
});
