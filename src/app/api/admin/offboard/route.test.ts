import { beforeEach, describe, expect, it, vi } from "vitest";

/* Admin SDK 대역 — 문서 경로 → 데이터 맵. where 는 == / array-contains 만, batch 는 커밋 때 반영합니다. */
let docs: Record<string, Record<string, unknown>>;
let authCalls: string[];
let logSeq = 0;

const ref = (path: string) => ({
  path,
  id: path.split("/").pop()!,
  get: async () => ({ exists: path in docs, data: () => docs[path] }),
});

const fakeDb = {
  doc: ref,
  collection: (name: string) => ({
    doc: () => ref(`${name}/log${++logSeq}`),
    where: (field: string, op: string, value: unknown) => ({
      get: async () => ({
        docs: Object.entries(docs)
          .filter(([p]) => p.startsWith(`${name}/`) && p.split("/").length === 2)
          .filter(([, d]) =>
            op === "array-contains"
              ? Array.isArray(d[field]) && (d[field] as unknown[]).includes(value)
              : d[field] === value,
          )
          .map(([p, d]) => ({ id: p.split("/")[1], ref: ref(p), data: () => d })),
      }),
    }),
  }),
  batch: () => {
    const ops: (() => void)[] = [];
    return {
      update: (r: { path: string }, patch: Record<string, unknown>) =>
        ops.push(() => (docs[r.path] = { ...docs[r.path], ...patch })),
      create: (r: { path: string }, data: Record<string, unknown>) => ops.push(() => (docs[r.path] = data)),
      commit: async () => ops.forEach((op) => op()),
    };
  },
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
      updateUser: async (uid: string, o: { disabled: boolean }) => {
        authCalls.push(`${o.disabled ? "disable" : "enable"}:${uid}`);
      },
      revokeRefreshTokens: async (uid: string) => {
        authCalls.push(`revoke:${uid}`);
      },
    },
  }),
}));

const { POST } = await import("./route");

async function call(token: string, body: unknown) {
  const res = await POST(
    new Request("http://x/api/admin/offboard", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, json: await res.json() };
}

const user = (uid: string, o: Record<string, unknown> = {}) => ({
  uid,
  name: uid,
  position: "매니저",
  teamId: null,
  managerId: null,
  role: "MEMBER",
  status: "ACTIVE",
  ...o,
});

const logs = () => Object.entries(docs).filter(([p]) => p.startsWith("auditLogs/")).map(([, d]) => d);

beforeEach(() => {
  authCalls = [];
  docs = {
    "users/adm": user("adm", { role: "ADMIN" }),
    "users/sup": user("sup", { role: "SUPER_ADMIN" }),
    "users/sup2": user("sup2", { role: "SUPER_ADMIN" }),
    "users/leaver": user("leaver", { managerId: "boss" }),
    "users/succ": user("succ", { teamId: "t2", managerId: "leaver" }),
    "users/rep": user("rep", { managerId: "leaver" }),
    "users/ph": user("ph", { status: "PLACEHOLDER" }),
    "approvals/A1": {
      authorUid: "rep",
      status: "In Progress",
      currentApproverUid: "leaver",
      approverUids: ["rep", "x", "leaver"],
      approverSeq: ["x", "leaver"],
      step: 1,
      line: [
        { kind: "기안", uid: "rep", done: true },
        { kind: "결재", uid: "x", done: true },
        { kind: "결재", uid: "leaver", name: "leaver", done: false },
      ],
    },
    "approvals/A2": {
      authorUid: "succ",
      status: "Waiting",
      currentApproverUid: "leaver",
      approverUids: ["succ", "leaver"],
      approverSeq: ["leaver"],
      step: 0,
      line: [
        { kind: "기안", uid: "succ", done: true },
        { kind: "결재", uid: "leaver", done: false },
      ],
    },
    "tasks/T1": { assigneeId: "leaver", colKey: "doing", who: "leaver" },
    "tasks/T2": { assigneeId: "leaver", colKey: "done", who: "leaver" },
  };
});

describe("권한", () => {
  it("관리자가 아니면 거부", async () => {
    expect((await call("rep", { action: "preview", uid: "leaver" })).status).toBe(403);
  });

  it("2FA 를 켠 관리자는 2FA 통과 토큰이어야 한다", async () => {
    docs["users/adm"].twoFactorId = "e1";
    expect((await call("adm", { action: "preview", uid: "leaver" })).status).toBe(403);
    expect((await call("adm:e1", { action: "preview", uid: "leaver" })).status).toBe(200);
  });

  it("본인·가계정은 퇴사 처리할 수 없다", async () => {
    expect((await call("adm", { action: "offboard", uid: "adm" })).json.error).toBe("self");
    expect((await call("adm", { action: "offboard", uid: "ph" })).json.error).toBe("not_account");
  });

  it("최고 관리자는 최고 관리자만", async () => {
    expect((await call("adm", { action: "offboard", uid: "sup" })).status).toBe(403);
    expect((await call("sup2", { action: "offboard", uid: "sup" })).status).toBe(200);
  });
});

describe("퇴사 처리", () => {
  it("넘길 일이 있으면 후임자를 지정해야 한다", async () => {
    const r = await call("adm", { action: "offboard", uid: "leaver" });
    expect(r.json.error).toBe("successor_required");
    expect(docs["users/leaver"].status).toBe("ACTIVE");
    expect(authCalls).toEqual([]);
  });

  it("preview 는 아무것도 바꾸지 않고 건수만", async () => {
    const r = await call("adm", { action: "preview", uid: "leaver", successorUid: "succ" });
    expect(r.json.counts).toEqual({ approvals: 1, tasks: 1, reports: 2, skippedApprovals: ["A2"] });
    expect(docs["users/leaver"].status).toBe("ACTIVE");
    expect(logs()).toHaveLength(0);
  });

  it("계정 차단 · 인계 · 감사 로그", async () => {
    const r = await call("adm", { action: "offboard", uid: "leaver", successorUid: "succ" });
    expect(r.status).toBe(200);
    expect(docs["users/leaver"]).toMatchObject({ status: "RESIGNED", resignedBy: "adm" });
    expect(authCalls).toEqual(["disable:leaver", "revoke:leaver"]);

    // 결재: 현재 차례와 남은 단계만 후임자로, 끝난 단계는 그대로
    expect(docs["approvals/A1"]).toMatchObject({
      currentApproverUid: "succ",
      approverSeq: ["x", "succ"],
      approverUids: ["rep", "x", "leaver", "succ"],
    });
    expect((docs["approvals/A1"].line as { uid: string }[]).map((l) => l.uid)).toEqual(["rep", "x", "succ"]);
    // 후임자가 기안한 문서는 셀프 결재가 되므로 넘기지 않음
    expect(docs["approvals/A2"].currentApproverUid).toBe("leaver");

    expect(docs["tasks/T1"]).toMatchObject({ assigneeId: "succ", who: "succ", teamId: "t2" });
    expect(docs["tasks/T2"].assigneeId).toBe("leaver");

    expect(docs["users/rep"].managerId).toBe("succ");
    // 후임자가 퇴사자의 부하였으면 퇴사자의 상사 밑으로
    expect(docs["users/succ"].managerId).toBe("boss");

    const [log] = logs();
    expect(log).toMatchObject({ actorUid: "adm", action: "user.offboard" });
    expect(log.targets).toEqual(
      expect.arrayContaining(["users/leaver", "approvals/A1", "tasks/T1", "users/rep", "users/succ"]),
    );
  });

  it("후임자는 재직 중인 다른 구성원이어야 한다", async () => {
    docs["users/succ"].status = "RESIGNED";
    expect((await call("adm", { action: "offboard", uid: "leaver", successorUid: "succ" })).json.error).toBe(
      "successor_invalid",
    );
    expect((await call("adm", { action: "offboard", uid: "leaver", successorUid: "leaver" })).json.error).toBe(
      "successor_invalid",
    );
  });
});

describe("복직", () => {
  it("퇴사자만 복직, Auth 계정을 다시 켠다", async () => {
    expect((await call("adm", { action: "reinstate", uid: "rep" })).json.error).toBe("not_resigned");
    docs["users/rep"].status = "RESIGNED";
    expect((await call("adm", { action: "reinstate", uid: "rep" })).status).toBe(200);
    expect(docs["users/rep"]).toMatchObject({ status: "ACTIVE", resignedAt: null });
    expect(authCalls).toEqual(["enable:rep"]);
    expect(logs()[0]).toMatchObject({ action: "user.reinstate", targets: ["users/rep"] });
  });
});
