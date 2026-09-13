import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  fullyParallel: false,
  // One worker, deliberately. `fullyParallel: false` only orders tests within a
  // file; separate spec files would still run concurrently, and every one of
  // them mounts a software-rasterised MapLibre map. Several at once saturate
  // the CPU, which makes React commits and API responses miss their windows and
  // turns map assertions into coin flips. The suite is a correctness gate, not
  // a throughput benchmark.
  workers: 1,
  reporter: "list",
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5175",
    trace: "off",
    headless: true,
    // MapLibre needs a WebGL context before it will load a style. Headless
    // Chromium on a machine with no GPU refuses to create one by default, so the
    // map never initialises and every marker, route, and legend assertion in
    // map-workflow fails for a reason unrelated to the code under test.
    // SwiftShader is Chromium's software rasteriser; the flag is required
    // because automatic fallback to it is deprecated.
    launchOptions: {
      args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
    },
  },
});
