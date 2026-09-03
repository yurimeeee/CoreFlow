"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/firebase";

/** 브라우저에서 Firebase Analytics 를 1회 초기화합니다. (measurementId 있을 때만) */
export function FirebaseAnalytics() {
  useEffect(() => {
    void initAnalytics();
  }, []);
  return null;
}
