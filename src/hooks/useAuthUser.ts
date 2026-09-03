"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { firebaseAuth, firebaseDb, isFirebaseConfigured } from "@/lib/firebase";
import type { UserDoc } from "@/types/user";

interface AuthUserState {
  authUser: User | null;
  profile: UserDoc | null;
  loading: boolean;
}

/** 현재 로그인한 사용자와 Firestore `users/{uid}` 프로필을 함께 제공합니다. */
export function useAuthUser() {
  const [state, setState] = useState<AuthUserState>(() => ({
    authUser: null,
    profile: null,
    loading: isFirebaseConfigured,
  }));

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(firebaseAuth(), async (user) => {
      if (!user) {
        setState({ authUser: null, profile: null, loading: false });
        return;
      }
      try {
        const snap = await getDoc(doc(firebaseDb(), "users", user.uid));
        setState({
          authUser: user,
          profile: snap.exists() ? (snap.data() as UserDoc) : null,
          loading: false,
        });
      } catch {
        setState({ authUser: user, profile: null, loading: false });
      }
    });
  }, []);

  const logout = useCallback(() => signOut(firebaseAuth()), []);

  return { ...state, logout };
}
