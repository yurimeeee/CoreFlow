/**
 * 데모용 로그인 계정 생성.
 *   node --env-file=.env.local scripts/create-demo-user.mjs [email] [password] [displayName]
 * 기본: demo@coreflow.io / coreflow1234 / (이메일 앞부분)
 *
 * 첫 관리자 부트스트랩(/api/admin/bootstrap)은 인증된 이메일만 받는데, 데모
 * 주소는 실제 메일함이 없어 인증 링크를 받을 수 없습니다. FIREBASE_SERVICE_ACCOUNT
 * 가 있으면(= 프로젝트 소유자가 실행) Admin SDK 로 이메일 인증을 완료 처리합니다.
 */
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";

const email = process.argv[2] || "demo@coreflow.io";
const password = process.argv[3] || "coreflow1234";
const displayName = process.argv[4] || email.split("@")[0];

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const auth = getAuth(app);

try {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  console.log("created:", email, "as", displayName, "uid:", cred.user.uid);
} catch (e) {
  if (e.code === "auth/email-already-in-use") {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log("already exists, signed in:", email, "uid:", cred.user.uid);
  } else {
    console.error(e.code || e.message);
    process.exit(1);
  }
}
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccount) {
  const { cert, initializeApp: initAdmin } = await import("firebase-admin/app");
  const { getAuth: getAdminAuth } = await import("firebase-admin/auth");
  const adminAuth = getAdminAuth(initAdmin({ credential: cert(JSON.parse(serviceAccount)) }));
  const user = await adminAuth.getUserByEmail(email);
  await adminAuth.updateUser(user.uid, { emailVerified: true });
  console.log("email verified:", email);
} else {
  console.log("FIREBASE_SERVICE_ACCOUNT 없음 — 이메일 인증은 앱 화면의 인증 메일로 진행하세요.");
}
process.exit(0);
