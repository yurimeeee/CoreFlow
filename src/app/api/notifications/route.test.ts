import { beforeEach, describe, expect, it, vi } from "vitest";

/* Admin SDK 대역 — 문서 경로 → 데이터 맵. create() 는 이미 있으면 실패, where 는 "in" 만 */
let docs: Record<string, Record<string, unknown>>;
const fakeDb = {
  doc: (path: string) => ({
    get: async () => ({ exists: path in docs, data: () => docs[path] }),
    create: async (data: Record<string, unknown>) => {
      if (path in docs) throw new Error("ALREADY_EXISTS");
      docs[path] = data;
    },
  }),
  collection: (name: string) => ({
    where: (field: string, _op: string, values: unknown[]) => ({
      get: async () => ({
        docs: Object.entries(docs)
          .filter(([p, d]) => p.startsWith(`${name}/`) && p.split("/").length === 2 && values.includes(d[field]))
          .map(([p]) => ({ id: p.split("/")[1] })),
      }),
    }),
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

const { POST, mentionedNames } = await import("./route");

async function call(uid: string, body: unknown) {
  const res = await POST(
    new Request("http://x/api/notifications", {
      method: "POST",
      headers: { authorization: `Bearer ${uid}` },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, json: await res.json() };
}

const user = (name: string, o: Record<string, unknown> = {}) => ({
  name,
  position: "매니저",
  role: "MEMBER",
  status: "ACTIVE",
  ...o,
});

const inbox = (uid: string) =>
  Object.entries(docs)
    .filter(([p]) => p.startsWith(`users/${uid}/inbox/`))
    .map(([, d]) => d);

beforeEach(() => {
  docs = {
    "users/alice": user("앨리스"),
    "users/bob": user("밥"),
    "users/carol": user("캐롤"),
    "users/boss": user("대표", { role: "ADMIN" }),
    "users/quiet": user("조용", { gwSettings: { toggles: { inboxMention: false } } }),
    "users/gone": user("퇴사", { status: "RESIGNED" }),
    "approvals/A-1": {
      title: "출장비",
      authorUid: "alice",
      status: "In Progress",
      approverUids: ["alice", "bob", "boss"],
      line: [
        { kind: "기안", uid: "alice", state: "", done: true },
        { kind: "결재", uid: "bob", state: "승인", done: true },
        { kind: "결재", uid: "boss", state: "", done: false },
      ],
    },
    "leaves/L1": { uid: "alice", kind: "연차", start: "2026-11-10", end: "2026-11-10", status: "승인" },
    "tasks/T1": { title: "배포", createdBy: "alice", assigneeId: "bob" },
    "tasks/T1/comments/c1": { uid: "carol", body: "확인 부탁 @조용 @퇴사 @앨리스" },
    "notices/N1": { title: "공지", authorUid: "alice", status: "draft" },
    "notices/N1/comments/c1": { uid: "alice", body: "@밥 봐주세요" },
  };
});

describe("호출자가 실제로 한 일만", () => {
  it("결재: 결재란에서 승인한 사람만, 기안자에게", async () => {
    expect((await call("carol", { event: "approval_decided", id: "A-1" })).status).toBe(403);
    expect((await call("bob", { event: "approval_decided", id: "A-1" })).json.delivered).toBe(1);
    expect(inbox("alice")[0]).toMatchObject({ cat: "결재", href: "/approval/A-1", readAt: null });
  });

  it("대리 결재: 실제 처리한 사람만, 기안자와 원래 결재자에게", async () => {
    docs["approvals/A-1"].line = [
      { kind: "기안", uid: "alice", state: "", done: true },
      { kind: "결재", uid: "bob", state: "승인", done: true, proxyUid: "carol" },
    ];
    expect((await call("bob", { event: "approval_decided", id: "A-1" })).status).toBe(403);
    expect((await call("carol", { event: "approval_decided", id: "A-1" })).json.delivered).toBe(2);
    expect(inbox("alice")[0].title).toMatch(/캐롤님 대리 승인/);
    expect(inbox("bob")[0].title).toMatch(/캐롤님이 대리 승인했습니다/);
  });

  it("같은 알림은 한 번만", async () => {
    await call("bob", { event: "approval_decided", id: "A-1" });
    expect((await call("bob", { event: "approval_decided", id: "A-1" })).json.delivered).toBe(0);
    expect(inbox("alice")).toHaveLength(1);
  });

  it("연차 결정은 관리자만", async () => {
    expect((await call("bob", { event: "leave_decided", id: "L1" })).status).toBe(403);
    await call("boss", { event: "leave_decided", id: "L1" });
    expect(inbox("alice")[0]).toMatchObject({ cat: "근태", title: "연차 신청이 승인되었습니다" });
  });

  it("Task 담당 지정은 만든 사람·관리자만", async () => {
    expect((await call("carol", { event: "task_assigned", id: "T1" })).status).toBe(403);
    await call("alice", { event: "task_assigned", id: "T1" });
    expect(inbox("bob")[0]).toMatchObject({ cat: "Task" });
  });

  it("댓글은 본인이 쓴 것만", async () => {
    expect((await call("bob", { event: "comment_added", id: "tasks:T1:c1" })).status).toBe(403);
    expect((await call("carol", { event: "comment_added", id: "users:x:c1" })).status).toBe(403);
  });

  it("구성원이 아니면 거부", async () => {
    expect((await call("gone", { event: "task_assigned", id: "T1" })).status).toBe(403);
  });
});

describe("댓글·멘션 받는 사람", () => {
  it("관계자 + 멘션, 알림을 끈 사람·퇴사자·본인은 제외", async () => {
    await call("carol", { event: "comment_added", id: "tasks:T1:c1" });
    expect(inbox("bob")[0].title).toMatch(/^새 댓글/);
    expect(inbox("alice")[0].title).toMatch(/언급했습니다/);
    expect(inbox("quiet")).toHaveLength(0);
    expect(inbox("gone")).toHaveLength(0);
    expect(inbox("carol")).toHaveLength(0);
  });

  it("임시저장 공지의 멘션은 보내지 않는다", async () => {
    await call("alice", { event: "comment_added", id: "notices:N1:c1" });
    expect(inbox("bob")).toHaveLength(0);
  });

  it("@이름 파싱", () => {
    expect(mentionedNames("@밥 그리고 @캐롤, @밥")).toEqual(["밥", "캐롤"]);
  });
});
