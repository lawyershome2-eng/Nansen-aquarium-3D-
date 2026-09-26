import { createFileRoute } from "@tanstack/react-router";
import { cinemaStream } from "@/lib/cinema/stream.server";

export const Route = createFileRoute("/api/stream")({
  server: {
    handlers: {
      GET: ({ request }) => cinemaStream(request),
    },
  },
});
