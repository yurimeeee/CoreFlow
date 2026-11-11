import { beforeEach, describe, expect, it, vi } from "vitest";

/* Admin SDK 대역 — 경로 → 데이터. where 는 >=, <= 만, add 는 자동 id */
let docs: Record<string, Record<string, unknown>>;
type Filter = [string, string, unknown];
const query = (col: string, filters: Filter[] = []) => ({
  where: (f: string, op: string, v: unknown) => query(col, [...filters, [f, op, v]]),
  get: async () => ({
    docs: Object.entries(docs)
      .filter(([p]) => p.startsWith(`${col}/`) && p.split("/").length === col.split("/").length + 1)
      .filter(([, d]) =>
        filters.every(([f, op, v]) => (op === ">=" ? String(d[f]) >= String(v) : String(d[f]) <= String(v))),
      )
      .map(([p, d]) => ({ id: p.split("/").pop()!, data: () => d })),
  }),
});
let seq = 0;
const fakeDb = {
  doc: (path: string) => ({ get: async () => ({ exists: path in docs, data: () => docs[path] }) }),
  collection: (name: string) => ({
    ...query(name),
    add: async (data: Record<string, unknown>) => {
      docs[`${name}/auto${++seq}`] = data;
    },
  }),
};

vi.mock("@/lib/firebaseAdmin", () => ({
  firebaseAdmin: () => ({
    db: fakeDb,
    auth: {
      verifyIdToken: async (t: string) => {
        const [uid, twoFactorId] = t.split(":");
        return { uid, twoFactorId };
      },
    },
  }),
}));

const { POST } = await import("./route");

async function call(token: string, body: Record<string, unknown>) {
  const res = await POST(
    new Request("http://x/api/admin/attendance-export", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ start: "2026-11-09", end: "2026-11-15", kind: "daily", tz: "Asia/Seoul", ...body }),
    }),
  );
  return { status: res.status, text: await res.text(), headers: res.headers };
}

const ts = (iso: string) => ({ toMillis: () => Date.parse(iso) });
const user = (name: string, o: Record<string, unknown> = {}) => ({
  name,
  employeeId: `E-${name}`,
  position: "매니저",
  role: "MEMBER",
  status: "ACTIVE",
  teamId: "dev",
  ...o,
});
const audit = () => Object.entries(docs).filter(([p]) => p.startsWith("auditLogs/")).map(([, d]) => d);

beforeEach(() => {
  docs = {
    "users/boss": user("대표", { role: "ADMIN", teamId: "hq" }),
    "users/tfa": user("보안", { role: "ADMIN", twoFactorId: "k1", teamId: "hq" }),
    "users/kim": user("김철수"),
    "users/lee": user("이영희", { teamId: "design" }),
    "users/old": user("퇴사자", { status: "RESIGNED" }),
    "users/ph": user("가계정", { status: "PLACEHOLDER" }),
    "teams/hq": { name: "경영", parentId: null },
    "teams/rnd": { name: "연구소", parentId: null },
    "teams/dev": { name: "개발팀", parentId: "rnd" },
    "teams/design": { name: "디자인팀", parentId: null },
    "attendance/kim/days/2026-11-10": {
      date: "2026-11-10",
      inTs: ts("2026-11-10T08:58:00+09:00"),
      outTs: ts("2026-11-10T18:00:00+09:00"),
    },
    "attendance/kim/days/2026-11-20": { date: "2026-11-20", inTs: ts("2026-11-20T09:00:00+09:00"), outTs: null },
    "leaves/L1": { uid: "lee", kind: "연차", start: "2026-11-11", end: "2026-11-11", days: 1, hours: 0, status: "승인" },
    "leaves/L2": { uid: "lee", kind: "연차", start: "2026-11-12", end: "2026-11-12", days: 1, hours: 0, status: "대기" },
  };
});

describe("근태 CSV 내보내기", () => {
  it("관리자만, 2FA 를 켠 관리자는 2FA 세션으로만", async () => {
    expect((await call("kim", {})).status).toBe(403);
    expect((await call("tfa", {})).status).toBe(403);
    expect((await call("tfa:k1", {})).status).toBe(200);
    expect((await call("old", {})).status).toBe(403);
  });

  it("기간 안 기록과 승인된 휴가만, 시각은 요청한 시간대로", async () => {
    const { status, text, headers } = await call("boss", {});
    expect(status).toBe(200);
    expect(headers.get("content-type")).toMatch(/text\/csv/);
    const lines = text.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines.slice(1)).toEqual([
      // 부서 → 이름 순
      "2026-11-11,이영희,E-이영희,디자인팀,매니저,,,,,연차",
      "2026-11-10,김철수,E-김철수,연구소 · 개발팀,매니저,08:58,18:00,8,정상,",
    ]);
  });

  it("부서를 고르면 하위 팀까지, 기록 없는 퇴사자·가계정은 빠진다", async () => {
    const { text } = await call("boss", { teamId: "rnd", kind: "summary" });
    const names = text.trim().split("\r\n").slice(1).map((l) => l.split(",")[0]);
    expect(names).toEqual(["김철수"]);
  });

  it("내보낼 때마다 감사 로그", async () => {
    await call("boss", { teamId: "rnd" });
    expect(audit()).toHaveLength(1);
    expect(audit()[0]).toMatchObject({
      actorUid: "boss",
      action: "attendance.export",
      targets: ["attendance/kim"],
    });
    expect(String(audit()[0].summary)).toContain("2026-11-09 ~ 2026-11-15");
  });

  it("잘못된 기간·시간대·부서는 거부하고 로그도 남기지 않는다", async () => {
    expect((await call("boss", { end: "2026-11-01" })).status).toBe(400);
    expect((await call("boss", { tz: "Mars/Base" })).status).toBe(400);
    expect((await call("boss", { teamId: "nope" })).status).toBe(400);
    expect(audit()).toHaveLength(0);
  });
});
