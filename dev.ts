#!/usr/bin/env node

import main from './src'

main().catch(e => {
  console.error(e);
});