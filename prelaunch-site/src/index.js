/**
 * Worker entry point.
 *
 * The static site in `public/` is served by Cloudflare's asset handler. Only
 * requests that match no asset reach this Worker, which is exactly the `/api/*`
 * routes — so the router below handles those and hands everything else back to
 * the asset handler for its own 404.
 *
 * Each route module exports `onRequestGet` and/or `onRequestPost` taking
 * `{ request, env, ctx }`. Dispatching on method here means a route that exists
 * but was called with the wrong verb answers 405 rather than falling through to
 * the static site and confusingly returning the landing page.
 */

import * as challenge from './routes/challenge.js';
import * as config from './routes/config.js';
import * as contact from './routes/contact.js';
import * as exportCsv from './routes/export.js';
import * as subscribe from './routes/subscribe.js';
import { fail } from '../lib/http.js';

const ROUTES = {
  '/api/challenge': challenge,
  '/api/config': config,
  '/api/contact': contact,
  '/api/export': exportCsv,
  '/api/subscribe': subscribe,
};

/** GET also answers HEAD; the runtime drops the body for us. */
const handlerFor = (route, method) =>
  route[`onRequest${method === 'HEAD' ? 'Get' : method[0] + method.slice(1).toLowerCase()}`];

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const route = ROUTES[pathname];

    if (!route) return env.ASSETS.fetch(request);

    const handler = handlerFor(route, request.method);
    if (!handler) return fail('Method not allowed.', 405);

    try {
      return await handler({ request, env, ctx });
    } catch (error) {
      // Never leak a stack trace to a visitor; the detail goes to the log.
      console.error(`unhandled error in ${request.method} ${pathname}`, error);
      return fail('Something went wrong. Please try again in a moment.', 500);
    }
  },
};
