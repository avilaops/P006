import { describe, expect, it } from "vitest";
import { webhookConfiguration } from "@/lib/evolution-whatsapp";

describe("Evolution WhatsApp webhook configuration", () => {
  it("uses the field names required by Evolution API", () => {
    expect(webhookConfiguration("https://tms.example/api/webhook")).toEqual({
      enabled: true,
      url: "https://tms.example/api/webhook",
      webhookByEvents: false,
      webhookBase64: false,
      events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
    });
  });
});
