import { CORE_VERSION } from "@swiss-transfer/core";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";

describe("GET /health", () => {
  it("returns ok and the core version", async () => {
    const res = await request(createApp()).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", core: CORE_VERSION });
  });

  it("does not advertise the framework", async () => {
    const res = await request(createApp()).get("/health");

    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
