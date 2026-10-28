"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseAuth, firebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import type { UserDoc } from "@/types/user";

interface AuthUserState {
  authUser: User | null;
  profile: UserDoc | null;
  loading: boolean;
}

/**
 * 현재 로그인한 사용자와 Firestore `users/{uid}` 프로필을 함께 제공합니다.
 * 프로필은 onSnapshot 으로 실시간 구독합니다 — 1회성 getDoc 이었다면 설정
 * 화면에서 2FA를 끄거나 이름을 바꿔도 AuthGuard 등 다른 컴포넌트가 들고
 * 있는 profile 이 stale 상태로 남습니다.
 */
export function useAuthUser() {
  const [state, setState] = useState<AuthUserState>(() => ({
    authUser: null,
    profile: null,
    loading: isFirebaseConfigured,
  }));

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(firebaseAuth(), (user) => {
      unsubProfile?.();
      unsubProfile = null;

      if (!user) {
        setState({ authUser: null, profile: null, loading: false });
        return;
      }

      // 프로필 스냅샷이 도착하기 전까지는 loading 으로 둡니다 — 로그아웃
      // 상태(loading:false)에서 로그인하면 profile:null 이 잠깐 "프로필 없음"
      // 으로 보여, AuthGuard 가 구성원 아님 화면을 깜빡 띄우게 됩니다.
      setState((s) => ({ ...s, authUser: user, loading: true }));
      unsubProfile = onSnapshot(
        doc(firebaseDb(), "users", user.uid),
        (snap) => {
          setState({
            authUser: user,
            profile: snap.exists() ? (snap.data() as UserDoc) : null,
            loading: false,
          });
        },
        () => setState({ authUser: user, profile: null, loading: false }),
      );
    });

    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  }, []);

  const logout = useCallback(() => signOut(firebaseAuth()), []);

  return { ...state, logout };
}
