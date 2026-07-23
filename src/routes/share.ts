import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Web Share Target action URL.
 * Service worker intercepts POST /share when installed; this is the fallback.
 */
export const Route = createFileRoute("/share")({
  beforeLoad: () => {
    throw redirect({ to: "/share-inbox" });
  },
  server: {
    handlers: {
      POST: async ({ request }) => {
        return Response.redirect(new URL("/share-inbox?manual=1", request.url), 303);
      },
      GET: async ({ request }) => {
        return Response.redirect(new URL("/share-inbox", request.url), 303);
      },
    },
  },
});
