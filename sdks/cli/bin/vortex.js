#!/usr/bin/env node

import { VortexCLI } from '../src/index.js';

const cli = new VortexCLI();
cli.run(process.argv.slice(2)).catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
