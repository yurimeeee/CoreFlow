/**
 * 관리자 작업 감사 로그 — auditLogs/{id}.
 *
 * 관리자 전용 쓰기(계정·초대장·팀·워크스페이스·웹훅·연차 결정)는 보안 규칙이
 * "같은 배치에 같은 관리자 명의로, 이 시각에 만든, 이 문서를 대상으로 적은
 * 감사 로그가 있을 때만" 허용합니다(firestore.rules 의 audited()). 그래서
 * 로그를 빼먹거나 나중에 지울 수 없습니다 — 로그는 수정·삭제 불가입니다.
 *
 * 규칙이 배치 안의 로그를 찾을 수 있도록 auditCursor/{관리자 uid} 에 이번 로그
 * id 를 함께 씁니다. 행위자·시각·대상은 규칙이 검증하고, summary/detail 은
 * 사람이 읽기 위한 설명(클라이언트가 적은 값)입니다.
 */
import { collection, doc, serverTimestamp, writeBatch, type WriteBatch } from "firebase/firestore";
import { firebaseAuth, firebaseDb } from "@/lib/firebase";

export const AUDIT_COL = "auditLogs";
export const AUDIT_CURSOR_COL = "auditCursor";

export type AuditAction =
  | "user.placeholder_create"
  | "user.update"
  | "user.delete"
  | "user.approve"
  | "user.reject"
  | "user.offboard"
  | "user.reinstate"
  | "invite.create"
  | "team.create"
  | "team.update"
  | "team.delete"
  | "workspace.update"
  | "integration.webhook_update"
  | "leave.approve"
  | "leave.reject"
  | "seed"
  | "admin.bootstrap";

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "user.placeholder_create": "가계정 생성",
  "user.update": "구성원 정보 수정",
  "user.delete": "구성원 삭제",
  "user.approve": "가입 승인",
  "user.reject": "가입 거절",
  "user.offboard": "퇴사 처리",
  "user.reinstate": "복직",
  "invite.create": "초대장 발급",
  "team.create": "팀 생성",
  "team.update": "팀 수정",
  "team.delete": "팀 삭제",
  "workspace.update": "워크스페이스 설정 변경",
  "integration.webhook_update": "웹훅 URL 변경",
  "leave.approve": "연차 승인",
  "leave.reject": "연차 반려",
  seed: "시드 데이터 생성",
  "admin.bootstrap": "첫 최고 관리자 설정",
};

export interface AuditLogDoc {
  id: string;
  actorUid: string;
  action: AuditAction;
  /** 바뀐 문서 경로 목록 (예: "users/abc") */
  targets: string[];
  summary: string;
  detail?: Record<string, unknown>;
  at: { toDate(): Date } | null;
}

export interface AuditEntry {
  action: AuditAction;
  targets: string[];
  summary: string;
  detail?: Record<string, unknown>;
}

/**
 * 감사 로그와 실제 변경을 한 배치로 커밋합니다. apply 안에서 같은 batch 에
 * 변경을 추가하세요 — 다른 경로로 쓰면 규칙이 로그를 찾지 못해 거부합니다.
 */
export async function auditedWrite(
  entry: AuditEntry,
  apply: (batch: WriteBatch) => void,
): Promise<void> {
  const uid = firebaseAuth().currentUser?.uid;
  if (!uid) throw new Error("로그인 세션을 확인할 수 없습니다.");
  const db = firebaseDb();
  const batch = writeBatch(db);
  const logRef = doc(collection(db, AUDIT_COL));
  batch.set(logRef, {
    actorUid: uid,
    action: entry.action,
    targets: entry.targets,
    summary: entry.summary,
    ...(entry.detail ? { detail: entry.detail } : {}),
    at: serverTimestamp(),
  });
  batch.set(doc(db, AUDIT_CURSOR_COL, uid), { logId: logRef.id });
  apply(batch);
  await batch.commit();
}
