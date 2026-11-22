import { onRequestPost as analyzeContent } from "./functions/api/analyze.js";
import {
  onRequestGet as getWorkspace,
  onRequestPost as postWorkspace,
  onRequestPut as putWorkspace
} from "./functions/api/workspace.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/analyze" && request.method === "POST") {
      return analyzeContent({ request, env, params: {}, data: {} });
    }
    if (url.pathname === "/api/workspace") {
      const handlers = { GET: getWorkspace, POST: postWorkspace, PUT: putWorkspace };
      const handler = handlers[request.method];
      if (handler) return handler({ request, env, params: {}, data: {} });
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, POST, PUT" } });
    }
    return env.ASSETS.fetch(request);
  }
};
