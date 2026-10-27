#!/usr/bin/env node
// Runs the TypeScript CLI directly through tsx, so the package needs no build step while it's a draft.
import { register } from "tsx/esm/api";
register();
await import("../src/cli/index.ts");
