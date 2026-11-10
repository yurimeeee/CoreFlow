/**
 * 결재 위임 — 휴가·출장 등으로 자리를 비우는 동안 내 결재 차례를 다른
 * 구성원이 대신 처리하도록 기간을 정해 맡깁니다(delegations/{내 uid}).
 *
 * 위임받은 사람은 그 기간에만 내 차례인 문서를 열람·승인·반려할 수 있고,
 * 결재란에는 원래 결재자 이름 그대로 남기되 proxyUid/proxyName 으로 실제
 * 처리한 사람을 함께 기록합니다. 기간·대상 검증은 firestore.rules 가 합니다.
 */
import type { Timestamp } from "firebase/firestore";

export interface DelegationDoc {
  delegateUid: string;
  /** 위임 시작(그날 00:00, 사용자 기준 시각) */
  from: Timestamp;
  /** 위임 끝(마지막 날 다음 날 00:00) — 이 시각부터는 위임이 풀립니다 */
  until: Timestamp;
  reason: string;
}

/** 위임 기간 최대 길이 — firestore.rules 와 같아야 합니다 */
export const MAX_DELEGATION_DAYS = 90;

/** "YYYY-MM-DD" 시작·끝 날짜(끝 날 포함) → [시작 00:00, 끝 다음 날 00:00) */
export function delegationRange(start: string, end: string): { from: Date; until: Date } | null {
  const parse = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const from = parse(start);
  const last = parse(end);
  if (!from || !last || last < from) return null;
  const until = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
  return { from, until };
}

export function delegationError(start: string, end: string, now: Date): string | null {
  const r = delegationRange(start, end);
  if (!r) return "기간을 확인해주세요.";
  if (r.until.getTime() <= now.getTime()) return "이미 지난 기간입니다.";
  if (r.until.getTime() - r.from.getTime() > MAX_DELEGATION_DAYS * 86_400_000) {
    return `위임 기간은 최대 ${MAX_DELEGATION_DAYS}일입니다.`;
  }
  return null;
}

export function isActiveDelegation(
  d: Pick<DelegationDoc, "from" | "until">,
  nowMs: number,
): boolean {
  return d.from.toMillis() <= nowMs && nowMs < d.until.toMillis();
}
