import { createFileRoute } from "@tanstack/react-router";
import { watchSuggestResponse } from "@/lib/cinema/watch.server";

export const Route = createFileRoute("/api/watch/suggest")({
  server: {
    handlers: {
      GET: ({ request }) => watchSuggestResponse(request),
    },
  },
});
