import { defineConfig } from "vitest/config";
import { vitestSetupFilePath, getClarinetVitestsArgv } from "@stacks/clarinet-sdk/vitest";
export default defineConfig({
  test: {
    environment: "clarinet",
    // remote_data forks mainnet, so calls take 10-40s. 5s default is far too low.
    testTimeout: 300000,
    hookTimeout: 300000,
    pool: "forks",
    // Each worker boots its own mainnet fork. With many at once, some failed to
    // start; two did not in a full run (D-012).
    maxWorkers: 2,
    setupFiles: [vitestSetupFilePath],
    environmentOptions: { clarinet: { ...getClarinetVitestsArgv() } },
  },
});
