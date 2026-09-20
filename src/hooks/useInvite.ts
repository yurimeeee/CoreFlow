"use client";

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { firebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import type { InviteDoc } from "@/types/user";

type InviteState =
  | { status: "loading"; invite: null; error: null }
  | { status: "valid"; invite: InviteDoc; error: null }
  | { status: "not-found"; invite: null; error: string }
  | { status: "expired"; invite: InviteDoc; error: string }
  | { status: "used"; invite: InviteDoc; error: string }
  | { status: "error"; invite: null; error: string };

const LOADING: InviteState = { status: "loading", invite: null, error: null };

function toDate(v: unknown): Date {
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v as string);
}

function mapInvite(id: string, raw: Record<string, unknown>): InviteDoc {
  return {
    id,
    token: String(raw.token ?? ""),
    email: String(raw.email ?? ""),
    employeeId: String(raw.employeeId ?? ""),
    teamId: (raw.teamId as string) ?? null,
    teamName: (raw.teamName as string) ?? "",
    managerId: (raw.managerId as string) ?? null,
    position: String(raw.position ?? ""),
    role: (raw.role as InviteDoc["role"]) ?? "MEMBER",
    status: (raw.status as InviteDoc["status"]) ?? "INVITED",
    requireApproval: Boolean(raw.requireApproval),
    invitedBy: (raw.invitedBy as string) ?? "",
    invitedByName: (raw.invitedByName as string) ?? "",
    createdAt: toDate(raw.createdAt),
    expiresAt: toDate(raw.expiresAt),
    completedUid: (raw.completedUid as string) ?? null,
    completedAt: raw.completedAt ? toDate(raw.completedAt) : null,
  };
}

/** 토큰을 검증해 다음 상태를 계산합니다. (부수효과 없음) */
async function resolveInvite(
  token: string | null | undefined,
): Promise<InviteState> {
  if (!token) {
    return {
      status: "not-found",
      invite: null,
      error: "초대 토큰이 없습니다. 초대 메일의 링크로 접속해 주세요.",
    };
  }
  if (!isFirebaseConfigured) {
    return {
      status: "error",
      invite: null,
      error: "Firebase 환경변수가 설정되지 않았습니다. (.env.local 확인)",
    };
  }

  try {
    const snap = await getDocs(
      query(
        collection(firebaseDb(), "invites"),
        where("token", "==", token),
        limit(1),
      ),
    );

    if (snap.empty) {
      return {
        status: "not-found",
        invite: null,
        error: "유효하지 않은 초대 링크입니다. 관리자에게 문의해 주세요.",
      };
    }

    const invite = mapInvite(snap.docs[0].id, snap.docs[0].data());

    if (invite.status === "COMPLETED") {
      return {
        status: "used",
        invite,
        error: "이미 가입이 완료된 초대 링크입니다. 로그인해 주세요.",
      };
    }
    if (toDate(invite.expiresAt).getTime() < Date.now()) {
      return {
        status: "expired",
        invite,
        error: "만료된 초대 링크입니다. 관리자에게 재발송을 요청해 주세요.",
      };
    }
    return { status: "valid", invite, error: null };
  } catch (err) {
    return {
      status: "error",
      invite: null,
      error:
        err instanceof Error ? err.message : "초대 정보를 불러오지 못했습니다.",
    };
  }
}

/**
 * 초대 토큰(`?token=xxx`)을 Firestore `invites` 컬렉션에서 조회하고
 * 만료 · 사용여부를 검증합니다.
 */
export function useInvite(token: string | null | undefined) {
  const [nonce, setNonce] = useState(0);
  const [entry, setEntry] = useState<{ key: string; state: InviteState }>();

  const key = `${nonce}::${token ?? ""}`;
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    resolveInvite(token).then((next) => {
      if (active) setEntry({ key, state: next });
    });
    return () => {
      active = false;
    };
  }, [key, token]);

  // 아직 이번 요청 결과가 도착하지 않았다면 로딩 상태로 취급합니다.
  const state = entry?.key === key ? entry.state : LOADING;

  return {
    ...state,
    isLoading: state.status === "loading",
    isValid: state.status === "valid",
    retry,
  };
}
