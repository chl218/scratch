// Wipes the e2e test data folder before the test server starts.
import { rm } from "node:fs/promises";

await rm(new URL("../.e2e-data", import.meta.url), { recursive: true, force: true });
