import { defineConfig } from "vitest/config";
import { vitestSetupFilePath, getClarinetVitestsArgv } from "@stacks/clarinet-sdk/vitest";
// Testnet fork only: its own manifest pinned at testnet block 719800. The test file
// uses a .fork.ts suffix so the main suite never picks it up.
export default defineConfig({
  test: {
    environment: "clarinet",
    include: ["tests/sbtc-testnet.fork.ts"],
    testTimeout: 300000,
    hookTimeout: 300000,
    pool: "forks",
    setupFiles: [vitestSetupFilePath],
    environmentOptions: {
      clarinet: { ...getClarinetVitestsArgv(), manifestPath: "./Clarinet-testnet.toml" },
    },
  },
});
