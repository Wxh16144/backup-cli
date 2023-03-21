#!/usr/bin/env node

import main from './dist/index.mjs'

main().catch(e => {
  console.error(e);
});