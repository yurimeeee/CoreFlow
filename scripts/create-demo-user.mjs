/**
 * 데모용 로그인 계정 생성.
 *   node --env-file=.env.local scripts/create-demo-user.mjs [email] [password]
 * 기본: demo@coreflow.io / coreflow1234
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

const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const auth = getAuth(app);

try {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: "김세진" });
  console.log("created:", email, "uid:", cred.user.uid);
} catch (e) {
  if (e.code === "auth/email-already-in-use") {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log("already exists, signed in:", email, "uid:", cred.user.uid);
  } else {
    console.error(e.code || e.message);
    process.exit(1);
  }
}
process.exit(0);
