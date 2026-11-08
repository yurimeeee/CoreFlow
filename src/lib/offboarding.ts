/**
 * 퇴사 처리 시 업무 인계 계산 — 서버(/api/admin/offboard)가 쓰는 순수 함수.
 * Firestore 에 의존하지 않아 단위 테스트로 검증합니다.
 */
import type { ApprovalDoc, TaskDoc } from "@/lib/groupware/firestore";

export interface Successor {
  uid: string;
  name: string;
  position: string;
  teamId: string | null;
}

/** 진행 중(아직 결재가 끝나지 않은) 결재 문서 — 임시저장 포함 */
export function isOpenApproval(a: Pick<ApprovalDoc, "status">) {
  return a.status === "Waiting" || a.status === "In Progress";
}

/**
 * 퇴사자가 아직 처리하지 않은 결재 단계를 후임자로 바꾼 patch. 바꿀 게
 * 없으면 null, 후임자가 그 문서의 기안자라 맡길 수 없으면 "self".
 *
 * line 의 결재 단계(기안 제외)와 approverSeq 는 인덱스가 1:1 이므로 같은
 * 위치를 함께 바꿉니다. 이미 끝난 단계(done)는 기록이라 그대로 둡니다.
 */
export function reassignApproval(
  a: Pick<ApprovalDoc, "status" | "authorUid" | "currentApproverUid" | "approverUids" | "approverSeq" | "step" | "line">,
  fromUid: string,
  to: Successor,
): Partial<ApprovalDoc> | "self" | null {
  if (!isOpenApproval(a) || a.authorUid === fromUid) return null;

  const step = a.step ?? 0;
  let touched = false;
  const line = (a.line ?? []).map((l) => {
    if (l.kind === "기안") return l;
    if (l.done || l.uid !== fromUid) return l;
    touched = true;
    return { ...l, uid: to.uid, name: to.name, role: to.position };
  });
  const seq = a.approverSeq?.map((u, i) => (i >= step && u === fromUid ? to.uid : u));
  const current = a.currentApproverUid === fromUid ? to.uid : a.currentApproverUid;
  if (!touched && current === a.currentApproverUid && (seq ?? []).every((u, i) => u === a.approverSeq?.[i])) {
    return null;
  }
  // 보안 규칙은 기안자가 결재선에 들어가는 걸(셀프 승인) 막습니다
  if (a.authorUid === to.uid) return "self";

  const patch: Partial<ApprovalDoc> = { line };
  if (seq) patch.approverSeq = seq;
  if (current !== a.currentApproverUid) patch.currentApproverUid = current;
  const uids = new Set(a.approverUids ?? []);
  if (!uids.has(to.uid)) patch.approverUids = [...uids, to.uid];
  return patch;
}

/** 퇴사자가 담당한 미완료 Task 를 후임자에게 */
export function reassignTask(t: Pick<TaskDoc, "assigneeId" | "colKey">, fromUid: string, to: Successor, doneCol: string) {
  if (t.assigneeId !== fromUid || t.colKey === doneCol) return null;
  return { assigneeId: to.uid, who: to.name, teamId: to.teamId };
}
