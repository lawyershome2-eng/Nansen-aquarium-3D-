import { createFileRoute } from "@tanstack/react-router";
import { cinemaWatch } from "@/lib/cinema/watch.server";

export const Route = createFileRoute("/api/watch/stream")({
  server: {
    handlers: {
      GET: ({ request }) => cinemaWatch(request),
    },
  },
});
