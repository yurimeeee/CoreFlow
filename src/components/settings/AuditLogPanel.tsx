"use client";

import * as React from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { History, Loader2, RotateCw } from "lucide-react";
import { firebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import { useOrgPeople } from "@/lib/groupware/hooks";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_COL,
  type AuditAction,
  type AuditLogDoc,
} from "@/lib/groupware/audit";
import { GwCard } from "@/components/app/primitives";
import { EmptyStateCompact } from "@/components/app/EmptyState";

const PAGE = 50;

/** 필터 — 작업 종류를 접두어(user.·invite.·…)로 묶습니다 */
const GROUPS: { key: string; label: string }[] = [
  { key: "", label: "전체" },
  { key: "user.", label: "계정" },
  { key: "invite.", label: "초대" },
  { key: "team.", label: "팀" },
  { key: "workspace.", label: "워크스페이스" },
  { key: "integration.", label: "연동" },
  { key: "leave.", label: "연차" },
];

const pad = (n: number) => String(n).padStart(2, "0");
function formatAt(d: Date | undefined) {
  if (!d) return "—";
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 최신순 한 페이지 — after 가 있으면 그다음부터 */
async function fetchPage(after: QueryDocumentSnapshot | null) {
  const base = collection(firebaseDb(), AUDIT_COL);
  const q = after
    ? query(base, orderBy("at", "desc"), startAfter(after), limit(PAGE))
    : query(base, orderBy("at", "desc"), limit(PAGE));
  const snap = await getDocs(q);
  return {
    page: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLogDoc),
    last: snap.docs[snap.docs.length - 1] ?? null,
    more: snap.docs.length === PAGE,
  };
}

/**
 * 관리자 감사 로그 — auditLogs 를 최신순으로 PAGE 개씩 불러옵니다. 로그는
 * 보안 규칙상 추가만 되고 바뀌지 않으므로 실시간 구독 대신 새로고침/더 보기로
 * 읽습니다. 종류 필터는 불러온 범위 안에서 적용합니다(복합 색인 불필요).
 */
export function AuditLogPanel() {
  // 퇴사자 이름도 찾아야 해서 people 대신 전체 users 기준 nameOf 를 씁니다
  const { nameOf } = useOrgPeople();
  const [logs, setLogs] = React.useState<AuditLogDoc[]>([]);
  const [cursor, setCursor] = React.useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(isFirebaseConfigured);
  const [error, setError] = React.useState(false);
  const [group, setGroup] = React.useState("");

  const load = React.useCallback(async (after: QueryDocumentSnapshot | null) => {
    setLoading(true);
    setError(false);
    try {
      const { page, last, more } = await fetchPage(after);
      setLogs((prev) => (after ? [...prev, ...page] : page));
      setCursor(last);
      setHasMore(more);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isFirebaseConfigured) return;
    let alive = true;
    fetchPage(null)
      .then(({ page, last, more }) => {
        if (!alive) return;
        setLogs(page);
        setCursor(last);
        setHasMore(more);
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const shown = group ? logs.filter((l) => l.action.startsWith(group)) : logs;

  return (
    <GwCard className="p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h3 className="text-[14.5px] font-semibold tracking-[-0.015em]">감사 로그</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            계정 · 초대 · 팀 · 워크스페이스 · 연동 · 연차 결정 등 관리자 작업 기록입니다. 기록은
            보안 규칙으로 강제되며 수정하거나 지울 수 없습니다.
          </p>
        </div>
        <button
          onClick={() => load(null)}
          disabled={loading}
          className="flex h-8.5 items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary disabled:opacity-60"
        >
          <RotateCw className="size-3.5" />
          새로고침
        </button>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setGroup(g.key)}
            className={
              group === g.key
                ? "h-7.5 rounded-full bg-primary px-3 text-[12px] font-semibold text-primary-foreground"
                : "h-7.5 rounded-full border border-border bg-card px-3 text-[12px] font-semibold text-secondary-foreground hover:bg-secondary"
            }
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="mt-3.5">
        {error ? (
          <p role="alert" className="text-[12.5px] font-medium text-destructive">
            감사 로그를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
          </p>
        ) : shown.length === 0 && !loading ? (
          <EmptyStateCompact
            icon={<History className="size-5" />}
            title="기록이 없습니다"
            desc={group ? "불러온 범위에 이 종류의 작업이 없습니다." : "관리자 작업이 생기면 여기에 쌓입니다."}
          />
        ) : (
          <ul className="flex flex-col">
            {shown.map((l) => (
              <li
                key={l.id}
                className="flex flex-col gap-1 border-t border-[#f1f5f9] py-2.5 first:border-t-0 sm:flex-row sm:items-baseline sm:gap-3"
              >
                <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground sm:w-[118px]">
                  {formatAt(l.at?.toDate())}
                </span>
                <span className="shrink-0 text-[12px] font-semibold sm:w-[132px]">
                  {AUDIT_ACTION_LABELS[l.action as AuditAction] ?? l.action}
                </span>
                <span className="min-w-0 flex-1 text-[12.5px] text-secondary-foreground [overflow-wrap:anywhere]">
                  {l.summary}
                </span>
                <span className="shrink-0 text-[12px] text-muted-foreground">{nameOf(l.actorUid)}</span>
              </li>
            ))}
          </ul>
        )}
        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {hasMore && !loading && (
          <button
            onClick={() => load(cursor)}
            className="mt-2 h-8.5 w-full rounded-[9px] border border-border bg-card text-[12.5px] font-semibold text-secondary-foreground hover:bg-secondary"
          >
            더 보기
          </button>
        )}
      </div>
    </GwCard>
  );
}
