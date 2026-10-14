import { defineConfig, configDefaults } from "vitest/config";
import { LOCAL_SUITES } from "./vitest.local.config";
import { vitestSetupFilePath, getClarinetVitestsArgv } from "@stacks/clarinet-sdk/vitest";
export default defineConfig({
  test: {
    environment: "clarinet",
    // the suites that need no mainnet contract run without a fork (vitest.local.config.ts, #45)
    exclude: [...configDefaults.exclude, ...LOCAL_SUITES],
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
