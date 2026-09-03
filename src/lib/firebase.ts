/**
 * Firebase (v10+ Modular SDK) 초기화
 * - Authentication : 이메일/비밀번호 계정
 * - Cloud Firestore : users / invites 컬렉션
 * - Storage        : 프로필 이미지 · 전자결재 서명 파일
 *
 * 환경변수는 `.env.local` 에 정의합니다. (`.env.local.example` 참고)
 *
 * SDK 인스턴스는 최초 접근 시점(브라우저 런타임)에 생성됩니다.
 * 덕분에 환경변수가 없는 빌드/프리렌더 단계에서도 안전하게 import 할 수 있습니다.
 */
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

export function firebaseApp(): FirebaseApp {
  if (appInstance) return appInstance;
  appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return appInstance;
}

/** Firebase Auth 인스턴스 (지연 초기화) */
export function firebaseAuth(): Auth {
  return (authInstance ??= getAuth(firebaseApp()));
}

/** Cloud Firestore 인스턴스 (지연 초기화) */
export function firebaseDb(): Firestore {
  return (dbInstance ??= getFirestore(firebaseApp()));
}

/** Firebase Storage 인스턴스 (지연 초기화) */
export function firebaseStorage(): FirebaseStorage {
  return (storageInstance ??= getStorage(firebaseApp()));
}
