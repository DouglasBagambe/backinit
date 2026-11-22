import { describe, expect, it } from "vitest";
import { nativePlayerDocument } from "../apps/native/src/player-embed";

describe("native embedded playback", () => {
  it("provides a parent frame and real origin without granting popup navigation", () => {
    const source = nativePlayerDocument(
      "https://provider.example/embed?id=1&lang=en",
    );
    expect(source.baseUrl).toBe("https://backinit.live/");
    expect(source.html).toContain(
      'src="https://provider.example/embed?id=1&amp;lang=en"',
    );
    expect(source.html).not.toContain("allow-popups");
    expect(source.html).not.toContain("allow-top-navigation");
  });
  it("supplies YouTube player identity and rejects insecure sources", () => {
    expect(
      nativePlayerDocument("https://www.youtube-nocookie.com/embed/abc").html,
    ).toContain("enablejsapi=1");
    expect(() => nativePlayerDocument("javascript:alert(1)")).toThrow();
  });
});
