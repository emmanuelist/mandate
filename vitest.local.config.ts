import { defineConfig } from "vitest/config";
import { vitestSetupFilePath, getClarinetVitestsArgv } from "@stacks/clarinet-sdk/vitest";
// The suites that touch only local contracts, on Clarinet-local.toml, which forks
// nothing and so sends nothing to Hiro's API (#45). The main config excludes them.
export const LOCAL_SUITES = [
  "tests/v5.test.ts", "tests/v5-adversarial.test.ts", "tests/v5-hostile.test.ts",
  "tests/phishing.test.ts", "tests/delegate.test.ts", "tests/v5-invariants.test.ts", "tests/reentry.test.ts",
];
export default defineConfig({
  test: {
    environment: "clarinet",
    include: LOCAL_SUITES,
    pool: "forks",
    setupFiles: [vitestSetupFilePath],
    environmentOptions: { clarinet: { ...getClarinetVitestsArgv(), manifestPath: "./Clarinet-local.toml" } },
  },
});
