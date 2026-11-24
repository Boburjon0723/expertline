import { beforeEach, describe, expect, it, vi } from "vitest";

/** Har bir createUploadTask chaqiruvi uchun boshqariladigan vazifa. */
type FakeTask = {
  uri: string;
  resolve: (r: { status: number; body: string }) => void;
  reject: (e: unknown) => void;
  progress: (sent: number, total: number) => void;
  cancelled: boolean;
};
const created: FakeTask[] = [];

vi.mock("expo-file-system/legacy", () => ({
  FileSystemUploadType: { MULTIPART: 1 },
  FileSystemSessionType: { BACKGROUND: 0, FOREGROUND: 1 },
  createUploadTask: (_url: string, uri: string, _opts: unknown, cb: (p: { totalBytesSent: number; totalBytesExpectedToSend: number }) => void) => {
    let resolve!: FakeTask["resolve"];
    let reject!: FakeTask["reject"];
    const p = new Promise<{ status: number; body: string }>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const t: FakeTask = {
      uri,
      resolve,
      reject,
      progress: (sent, total) => cb({ totalBytesSent: sent, totalBytesExpectedToSend: total }),
      cancelled: false,
    };
    created.push(t);
    return {
      uploadAsync: () => p,
      cancelAsync: async () => {
        t.cancelled = true;
      },
    };
  },
}));
vi.mock("react-native", () => ({
  AppState: { currentState: "active", addEventListener: vi.fn() },
}));
vi.mock("../src/lib/config", () => ({ API_URL: "https://api.test" }));
vi.mock("../src/lib/auth-storage", () => ({ getToken: async () => "tok" }));
vi.mock("../src/lib/media-cache", () => ({ putLocalInMediaCache: async () => undefined }));
vi.mock("../src/lib/media-thumb", () => ({ createMediaThumb: async () => "data:image/jpeg;base64,AA" }));

const replaced: string[] = [];
vi.mock("../src/store/chatStore", () => ({
  useChatStore: {
    getState: () => ({
      addMessageLocally: vi.fn(),
      removeMessagesLocally: vi.fn(),
      replaceMessageLocally: (_c: string, oldId: string) => replaced.push(oldId),
    }),
  },
}));
vi.mock("../src/features/chat/service", () => ({
  messageTypeFromMime: (m: string) => (m.startsWith("image/") ? "image" : "file"),
  sendMessageRequest: async (_chat: string, url: string) => ({ id: `srv_${url}` }),
}));

const ok = (url: string) => ({ status: 200, body: JSON.stringify({ files: [{ url }] }) });
const flush = async () => {
  // Dinamik importlar (media-thumb) bir necha makro-vazifa oladi.
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

describe("upload-queue", () => {
  beforeEach(() => {
    created.length = 0;
    replaced.length = 0;
    vi.resetModules();
  });

  it("one hung upload does not block the others (parallel)", async () => {
    const q = await import("../src/lib/upload-queue");
    const ids = [1, 2, 3, 4].map((n) =>
      q.enqueueChatUpload({ chatId: "c", senderId: "u", uri: `file:///p${n}.jpg`, name: `p${n}.jpg`, mime: "image/jpeg" })
    );
    await flush();
    expect(created.map((t) => t.uri)).toEqual(["file:///p1.jpg", "file:///p2.jpg", "file:///p3.jpg"]);

    // p1 osilib qoladi; p2 va p3 tugaydi -> p4 boshlanadi va tugaydi.
    created[1].resolve(ok("u2"));
    created[2].resolve(ok("u3"));
    await flush();
    expect(created.map((t) => t.uri)).toContain("file:///p4.jpg");
    created[3].resolve(ok("u4"));
    await flush();

    expect(replaced.sort()).toEqual([ids[1], ids[2], ids[3]].sort());
  });

  it("a stalled upload is cancelled after 45s without progress and retried", async () => {
    vi.useFakeTimers();
    try {
      const q = await import("../src/lib/upload-queue");
      const id = q.enqueueChatUpload({ chatId: "c", senderId: "u", uri: "file:///a.jpg", name: "a.jpg", mime: "image/jpeg" });
      await vi.advanceTimersByTimeAsync(0);
      expect(created).toHaveLength(1);
      created[0].progress(100, 1000);

      await vi.advanceTimersByTimeAsync(50_000); // progress yo'q -> watchdog
      expect(created[0].cancelled).toBe(true);

      await vi.advanceTimersByTimeAsync(2_000); // birinchi qayta urinish kechikishi
      expect(created).toHaveLength(2);
      created[1].resolve(ok("ua"));
      await vi.advanceTimersByTimeAsync(0);
      expect(replaced).toEqual([id]);
    } finally {
      vi.useRealTimers();
    }
  });
});
