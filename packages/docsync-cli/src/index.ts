#!/usr/bin/env node
import { runCli } from "./cli";

runCli(process.argv).then((code) => {
  process.exitCode = code;
});
