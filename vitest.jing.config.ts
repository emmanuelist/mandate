import { defineConfig } from "vitest/config";
import { vitestSetupFilePath, getClarinetVitestsArgv } from "@stacks/clarinet-sdk/vitest";
// Jing fork only: its own manifest pinned at block 9036500. The test file uses
// a .fork.ts suffix so the main suite never picks it up.
export default defineConfig({
  test: {
    environment: "clarinet",
    include: ["tests/jing-fork.fork.ts"],
    testTimeout: 300000,
    hookTimeout: 300000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    setupFiles: [vitestSetupFilePath],
    environmentOptions: {
      clarinet: { ...getClarinetVitestsArgv(), manifestPath: "./Clarinet-jing.toml" },
    },
  },
});
