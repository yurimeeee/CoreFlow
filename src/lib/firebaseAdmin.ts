/**
 * 서버 전용 Firebase Admin SDK — Route Handler 에서만 import 합니다.
 *
 * 서비스 계정(FIREBASE_SERVICE_ACCOUNT, JSON 문자열)은 보안 규칙을 거치지
 * 않으므로, 이걸 쓰는 코드는 호출자 검증(verifyIdToken + 구성원 확인)을
 * 반드시 먼저 해야 합니다. 환경변수가 없으면 null 을 돌려 호출한 쪽이
 * "미설정" 응답을 하도록 합니다.
 */
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function adminApp(): App | null {
  const existing = getApps()[0];
  if (existing) return existing;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return initializeApp({ credential: cert(JSON.parse(raw)) });
  } catch {
    return null;
  }
}

export function firebaseAdmin() {
  const app = adminApp();
  return app ? { auth: getAuth(app), db: getFirestore(app) } : null;
}
