/**
 * Node-side MSW server used by Vitest. Each suite starts the server
 * once, resets handlers between tests, and stops it at the end so
 * there are no cross-suite network side effects.
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
