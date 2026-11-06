import { beforeEach, describe, expect, it, vi } from "vitest";

/* Admin SDK 대역 — 문서 경로 → 데이터 맵. create() 는 이미 있으면 실패합니다. */
let docs: Record<string, Record<string, unknown>>;
const fakeDb = {
  doc: (path: string) => ({
    get: async () => ({ exists: path in docs, data: () => docs[path] }),
    create: async (data: Record<string, unknown>) => {
      if (path in docs) throw new Error("ALREADY_EXISTS");
      docs[path] = data;
    },
    delete: async () => {
      delete docs[path];
    },
  }),
};

vi.mock("@/lib/firebaseAdmin", () => ({
  firebaseAdmin: () => ({
    db: fakeDb,
    // 테스트에선 토큰 문자열 = uid (2FA 클레임은 "uid:twoFactorId")
    auth: {
      verifyIdToken: async (t: string) => {
        const [uid, twoFactorId] = t.split(":");
        return { uid, twoFactorId };
      },
    },
  }),
}));

const { POST } = await import("./route");

const sent: { url: string; body: Record<string, unknown> }[] = [];
const okFetch = async (url: string, init: { body: string }) => {
  sent.push({ url, body: JSON.parse(init.body) });
  return new Response("ok", { status: 200 });
};

function call(uid: string, body: unknown) {
  return POST(
    new Request("http://x/api/integrations/notify", {
      method: "POST",
      headers: { authorization: `Bearer ${uid}` },
      body: JSON.stringify(body),
    }),
  );
}

const user = (name: string, o: Record<string, unknown> = {}) => ({
  name,
  position: "매니저",
  role: "MEMBER",
  status: "ACTIVE",
  ...o,
});

beforeEach(() => {
  sent.length = 0;
  vi.stubGlobal("fetch", okFetch);
  docs = {
    "users/alice": user("앨리스"),
    "users/bob": user("밥"),
    "users/boss": user("대표", { role: "ADMIN", position: "대표" }),
    "users/tfa": user("투에프", { twoFactorId: "e1" }),
    "workspace/main": { integrations: { slack: { on: true }, jandi: { on: true } } },
    "integrationSecrets/main": {
      slack: { webhookUrl: "https://hooks.slack.com/services/T/B/x" },
      jandi: { webhookUrl: "https://wh.jandi.com/connect-api/webhook/1/x" },
    },
    "notices/n1": { title: "점심 공지", body: "12시", pinned: true, authorUid: "alice", status: "published" },
    "notices/d1": { title: "초안", body: "", pinned: false, authorUid: "alice", status: "draft" },
    "approvals/A-1": {
      title: "출장비",
      authorUid: "alice",
      bucket: "pending",
      status: "In Progress",
      approverSeq: ["bob", "boss"],
      line: [
        { kind: "기안", uid: "alice", state: "", done: true },
        { kind: "결재", uid: "bob", state: "승인", done: true },
        { kind: "결재", uid: "boss", state: "", done: false },
      ],
    },
    "leaves/L1": { uid: "alice", who: "앨리스", kind: "연차", start: "2026-11-10", end: "2026-11-10", reason: "개인", status: "대기" },
    "leaves/L2": { uid: "alice", who: "앨리스", kind: "연차", start: "2026-11-11", end: "2026-11-11", reason: "", status: "승인" },
  };
});

describe("문구는 서버가 문서로 만든다", () => {
  it("클라이언트가 보낸 text 는 쓰지 않는다 — event 가 없으면 거부", async () => {
    const res = await call("alice", { service: "slack", text: "[공지] 대표: 오늘 휴무" });
    expect(res.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("공지 게시 — 작성자 이름·직급과 문서 내용으로 보낸다", async () => {
    expect((await call("alice", { event: "notice_published", id: "n1" })).status).toBe(200);
    expect(sent[0].url).toContain("hooks.slack.com");
    expect(sent[0].body.text).toBe("📌 [공지] 점심 공지\n앨리스 매니저 · 12시");
  });

  it("결재 상신 — 결재자는 결재선 마지막 사람", async () => {
    await call("alice", { event: "approval_submitted", id: "A-1" });
    expect(sent[0].body.text).toBe("[결재 상신] 출장비 (A-1)\n기안자 앨리스 매니저 · 결재자 대표 대표");
  });

  it("연차 신청·승인은 Jandi 로", async () => {
    await call("alice", { event: "leave_requested", id: "L1" });
    await call("boss", { event: "leave_decided", id: "L2" });
    expect(sent.map((s) => s.url.includes("jandi"))).toEqual([true, true]);
    expect(sent[1].body.body).toBe("[근태] 앨리스님의 연차 신청이 승인되었습니다. (2026-11-11 ~ 2026-11-11)");
  });
});

describe("그 일을 한 사람만 알림을 보낼 수 있다", () => {
  it("남의 공지·임시저장 공지는 거부", async () => {
    expect((await call("bob", { event: "notice_published", id: "n1" })).status).toBe(403);
    expect((await call("alice", { event: "notice_published", id: "d1" })).status).toBe(403);
  });

  it("기안자가 아니면 상신 알림 거부, 결재하지 않은 사람은 결재 알림 거부", async () => {
    expect((await call("bob", { event: "approval_submitted", id: "A-1" })).status).toBe(403);
    expect((await call("boss", { event: "approval_decided", id: "A-1" })).status).toBe(403);
    expect((await call("bob", { event: "approval_decided", id: "A-1" })).status).toBe(200);
  });

  it("남의 연차 신청 알림, 관리자가 아닌 승인 알림은 거부", async () => {
    expect((await call("bob", { event: "leave_requested", id: "L1" })).status).toBe(403);
    expect((await call("bob", { event: "leave_decided", id: "L2" })).status).toBe(403);
    expect((await call("boss", { event: "leave_decided", id: "L1" })).status).toBe(403); // 아직 대기
  });

  it("2FA를 통과하지 않은 세션은 거부", async () => {
    expect((await call("tfa", { event: "notice_published", id: "n1" })).status).toBe(403);
  });

  it("테스트 전송은 관리자만, 문구는 서버 고정", async () => {
    const test = { test: { service: "slack", webhookUrl: "https://hooks.slack.com/services/x" } };
    expect((await call("alice", test)).status).toBe(403);
    expect((await call("boss", test)).status).toBe(200);
    expect(String(sent[0].body.text)).toContain("CoreFlow 연동 테스트");
  });
});

describe("같은 이벤트는 한 번만", () => {
  it("다시 호출해도 두 번째는 보내지 않는다", async () => {
    await call("alice", { event: "notice_published", id: "n1" });
    const again = await call("alice", { event: "notice_published", id: "n1" });
    expect(await again.json()).toMatchObject({ ok: true, duplicate: true });
    expect(sent).toHaveLength(1);
  });

  it("전송이 실패하면 기록을 지워 다시 보낼 수 있다", async () => {
    vi.stubGlobal("fetch", async () => new Response("no", { status: 500 }));
    expect((await call("alice", { event: "notice_published", id: "n1" })).status).toBe(502);
    expect("notifyLog/notice_n1" in docs).toBe(false);
  });
});
