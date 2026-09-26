/**
 * 다크 모드 — 계정 설정(Firestore)이 아니라 브라우저별 로컬 선호값입니다.
 *
 * 로그인 전(로그인/가입 화면)에도 적용돼야 하고 첫 페인트 전에 반영돼야
 * 깜빡임(FOUC)이 없어서, `RootLayout`의 인라인 스크립트가 이 모듈과
 * 같은 key("cf_theme")·규칙으로 초기 class를 먼저 세팅합니다. 이 모듈은
 * 이후 토글 상호작용과 System 변경 감지를 담당합니다.
 */

export type ThemeMode = "light" | "dark" | "system";

const KEY = "cf_theme";

type Listener = () => void;
const listeners = new Set<Listener>();

function readStored(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === "light" || raw === "dark" ? raw : "system";
  } catch {
    return "system";
  }
}

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function resolveThemeMode(mode: ThemeMode): "light" | "dark" {
  return mode === "system" ? (prefersDark() ? "dark" : "light") : mode;
}

function applyToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveThemeMode(mode) === "dark");
}

let currentMode: ThemeMode = readStored();

export function getThemeMode(): ThemeMode {
  return currentMode;
}

export function setThemeMode(mode: ThemeMode): void {
  currentMode = mode;
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, mode);
  } catch {
    /* 저장소를 쓸 수 없는 환경(프라이빗 모드 등)이면 조용히 무시 */
  }
  applyToDocument(mode);
  listeners.forEach((l) => l());
}

export function subscribeThemeMode(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (currentMode === "system") {
      applyToDocument(currentMode);
      listeners.forEach((l) => l());
    }
  });
}
