"use client";

import { useCallback, useState } from "react";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import {
  firebaseAuth,
  firebaseDb,
  firebaseStorage,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { fileExt } from "@/lib/utils";
import type {
  SignUpPayload,
  SignUpResult,
  UserDoc,
  UserStatus,
} from "@/types/user";

export type SignUpPhase =
  | "idle"
  | "creating-account"
  | "uploading-files"
  | "saving-profile"
  | "finalizing"
  | "done"
  | "error";

const PHASE_LABEL: Record<SignUpPhase, string> = {
  idle: "",
  "creating-account": "계정을 생성하는 중…",
  "uploading-files": "프로필 · 서명 파일을 업로드하는 중…",
  "saving-profile": "사용자 정보를 저장하는 중…",
  finalizing: "초대 정보를 확정하는 중…",
  done: "가입이 완료되었습니다.",
  error: "가입 처리 중 문제가 발생했습니다.",
};

function mapAuthError(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/email-already-in-use":
        return "이미 가입된 이메일입니다. 로그인 화면을 이용해 주세요.";
      case "auth/invalid-email":
        return "이메일 형식이 올바르지 않습니다.";
      case "auth/weak-password":
        return "비밀번호는 6자 이상이어야 합니다.";
      case "auth/network-request-failed":
        return "네트워크 연결을 확인해 주세요.";
      case "auth/too-many-requests":
        return "요청이 많아 잠시 후 다시 시도해 주세요.";
      case "storage/unauthorized":
        return "파일 업로드 권한이 없습니다. 관리자에게 문의해 주세요.";
      default:
        return err.message;
    }
  }
  return err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
}

async function uploadFile(
  uid: string,
  kind: "profile" | "signature",
  file: File,
): Promise<string> {
  const path = `users/${uid}/${kind}.${fileExt(file.name)}`;
  const snap = await uploadBytes(storageRef(firebaseStorage(), path), file, {
    contentType: file.type || "image/png",
    customMetadata: { uid, kind },
  });
  return getDownloadURL(snap.ref);
}

export function useSignUp() {
  const [phase, setPhase] = useState<SignUpPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SignUpResult | null>(null);

  const isSubmitting =
    phase !== "idle" && phase !== "done" && phase !== "error";

  const reset = useCallback(() => {
    setPhase("idle");
    setError(null);
    setResult(null);
  }, []);

  const signUp = useCallback(
    async (payload: SignUpPayload): Promise<SignUpResult | null> => {
      setError(null);
      setResult(null);

      if (!isFirebaseConfigured) {
        setPhase("error");
        setError("Firebase 환경변수가 설정되지 않았습니다. (.env.local 확인)");
        return null;
      }

      const { invite } = payload;

      try {
        /* 1. Firebase Auth 계정 생성 --------------------------------- */
        setPhase("creating-account");
        const cred = await createUserWithEmailAndPassword(
          firebaseAuth(),
          invite.email, // 초대된 이메일로 고정
          payload.password,
        );
        const { uid } = cred.user;

        /* 2. Storage 업로드 (선택) --------------------------------- */
        setPhase("uploading-files");
        let profileImageUrl: string | null = null;
        let signatureUrl: string | null = null;

        if (payload.profileImageFile) {
          profileImageUrl = await uploadFile(
            uid,
            "profile",
            payload.profileImageFile,
          );
        }
        if (payload.signatureFile) {
          signatureUrl = await uploadFile(
            uid,
            "signature",
            payload.signatureFile,
          );
        }

        /* 3. Auth 프로필 갱신 -------------------------------------- */
        await updateProfile(cred.user, {
          displayName: payload.name,
          photoURL: profileImageUrl ?? undefined,
        });

        /* 4. Firestore 저장 (users/{uid}) + invite 상태 변경 ------- */
        setPhase("saving-profile");

        const status: UserStatus = invite.requireApproval ? "PENDING" : "ACTIVE";

        const userDoc: Omit<UserDoc, "createdAt" | "updatedAt" | "joinedAt"> & {
          createdAt: ReturnType<typeof serverTimestamp>;
          updatedAt: ReturnType<typeof serverTimestamp>;
          joinedAt: Timestamp;
        } = {
          uid,
          email: invite.email,
          name: payload.name.trim(),
          teamId: invite.teamId,
          managerId: invite.managerId,
          presence: "online",
          position: invite.position,
          employeeId: invite.employeeId,
          joinedAt: Timestamp.fromDate(new Date(payload.joinedAt)),
          phone: payload.phone.trim(),
          profileImageUrl,
          extensionNumber: payload.extensionNumber.trim() || null,
          tasks: payload.tasks,
          signatureUrl,
          role: invite.role,
          status,
          inviteId: invite.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        setPhase("finalizing");
        const database = firebaseDb();
        const batch = writeBatch(database);
        batch.set(doc(database, "users", uid), userDoc);
        batch.update(doc(database, "invites", invite.id), {
          status: "COMPLETED",
          completedUid: uid,
          completedAt: serverTimestamp(),
        });
        await batch.commit();

        const out: SignUpResult = {
          uid,
          status,
          requireApproval: invite.requireApproval,
        };
        setResult(out);
        setPhase("done");
        return out;
      } catch (err) {
        setPhase("error");
        setError(mapAuthError(err));
        return null;
      }
    },
    [],
  );

  return {
    signUp,
    reset,
    phase,
    phaseLabel: PHASE_LABEL[phase],
    isSubmitting,
    isDone: phase === "done",
    error,
    result,
  };
}
