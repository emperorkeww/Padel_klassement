import { describe, it, expect } from "vitest";
import { pushSupported, urlBase64ToUint8Array, enablePush } from "@/lib/supabase/push";

describe("push", () => {
  it("decodeert een base64url-VAPID-sleutel naar bytes", () => {
    // "AQID" (base64url) = bytes [1, 2, 3]
    expect([...urlBase64ToUint8Array("AQID")]).toEqual([1, 2, 3]);
    // url-safe tekens - en _ worden vertaald (voorkomt atob-fouten).
    expect([...urlBase64ToUint8Array("-_8")]).toEqual([251, 255]);
  });

  it("meldt geen ondersteuning zonder PushManager (jsdom)", () => {
    expect(pushSupported()).toBe(false);
  });

  it("weigert inschakelen netjes zonder ondersteuning", async () => {
    await expect(enablePush("p1")).rejects.toThrow(/niet ondersteund/i);
  });
});
