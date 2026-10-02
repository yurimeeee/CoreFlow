/**
 * CoreFlow — 회원가입 / 사용자 데이터 모델
 * Firestore 구조:
 *   users/{uid}       ← Firebase Auth uid 를 문서 ID 로 사용
 *   invites/{inviteId}
 */
import type { Timestamp } from "firebase/firestore";

/* ------------------------------------------------------------------ */
/*  권한 · 상태                                                         */
/* ------------------------------------------------------------------ */

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "MEMBER";

/** PLACEHOLDER = 아직 초대/가입 전인 가계정 (조직도 전용, 실제 Auth 계정 없음) */
export type UserStatus =
  | "INVITED"
  | "PENDING"
  | "ACTIVE"
  | "SUSPENDED"
  | "PLACEHOLDER";

export type InviteStatus = "INVITED" | "PENDING" | "COMPLETED" | "EXPIRED";

/** 조직도 · 프로필 카드에 쓰는 근무 상태 (계정 상태 status 와는 별개) */
export type UserPresence = "online" | "remote" | "away" | "leave";

/* ------------------------------------------------------------------ */
/*  users/{uid}  (가계정은 users/{placeholder-<random>})                 */
/* ------------------------------------------------------------------ */

export interface UserDoc {
  uid: string;

  /* 계정 정보 (필수) */
  email: string;
  name: string;

  /* 조직 정보 (필수) */
  teamId: string | null; // teams/{id} 참조, null = 미배정
  managerId: string | null; // 직속 상사 uid, null = 최상위(대표)
  position: string; // 직급 / 직책

  /* 근태 · 보안 정보 (필수) */
  employeeId: string; // 사번
  joinedAt: Timestamp | Date; // 입사일
  phone: string; // 휴대폰 번호

  /* 선택 정보 */
  profileImageUrl?: string | null; // Storage 업로드
  extensionNumber?: string | null; // 사내 내선 번호
  tasks?: string[]; // 담당 업무 키워드 (예: ['Frontend', 'React'])
  signatureUrl?: string | null; // 전자결재용 서명 이미지
  presence?: UserPresence; // 근무 상태 (조직도 표시용, 기본 "online")

  /* 권한 · 상태 */
  role: UserRole;
  status: UserStatus;

  /* 그룹웨어 개인 설정 (알림 토글 · 연동 · 2FA 여부 · 언어/타임존) */
  gwSettings?: {
    toggles?: Record<string, boolean>;
    integrations?: Record<string, boolean>;
    /**
     * 2FA 활성화 여부만 — 실제 비밀키는 users/{uid}가 아니라 본인만
     * read/write 가능한 userSecrets/{uid}에 둡니다. users 컬렉션은
     * 조직도·결재자 검색용 사내 디렉터리라 로그인한 누구나 조회 가능한데,
     * 여기 비밀키까지 같이 두면 다른 직원이 그 값을 읽어 피해자의 2FA를
     * 그대로 우회할 수 있었습니다(twoFASecret이 users 문서 안에 있던
     * 이전 설계의 문제).
     */
    twoFA?: boolean;
    lang?: string;
    tz?: string;
  };

  /* 메타 */
  inviteId?: string | null;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

/**
 * userSecrets/{uid} — 2FA TOTP 비밀키·백업 코드 해시. 본인만 read/write
 * 가능한 별도 컬렉션(firestore.rules 참고). twoFA 켜짐 여부 자체는 이
 * 문서가 아니라 UserDoc.gwSettings.twoFA에 있습니다(그건 비밀값이
 * 아니라 "켜짐/꺼짐"만 나타내므로 여기 둘 필요가 없습니다).
 */
export interface UserSecretsDoc {
  /** TOTP 비밀키 (base32). 앱에서 검증하므로 본인 클라이언트에는 노출됩니다. */
  secret: string;
  /** 백업 코드는 평문이 아닌 SHA-256 해시로만 저장합니다. */
  backupCodeHashes: string[];
}

/* ------------------------------------------------------------------ */
/*  invites/{inviteId}  — 관리자가 미리 발급                            */
/* ------------------------------------------------------------------ */

export interface InviteDoc {
  id: string;
  token: string; // 초대 링크 쿼리스트링 ?token=xxx

  /* 관리자가 미리 채워두는 값 → 가입폼에서 Read-only 로 표시 */
  email: string;
  employeeId: string;
  teamId: string | null; // teams/{id} 참조
  teamName?: string; // 발급 시점 팀 이름 스냅샷 (가입 화면은 비로그인 상태라 teams 조회 없이 바로 표시)
  managerId: string | null; // 직속 상사 uid
  position: string;

  role: UserRole;
  status: InviteStatus;

  /** true 이면 가입 완료 후 status='PENDING' 으로 관리자 승인 대기 */
  requireApproval: boolean;

  invitedBy: string; // 발급 관리자 uid
  invitedByName?: string;
  createdAt: Timestamp | Date;
  expiresAt: Timestamp | Date;

  completedUid?: string | null;
  completedAt?: Timestamp | Date | null;
}

/* ------------------------------------------------------------------ */
/*  회원가입 폼 입력값 (클라이언트 상태)                                 */
/* ------------------------------------------------------------------ */

export interface SignUpFormValues {
  /* Step 1 — 계정 */
  email: string; // read-only (초대값)
  employeeId: string; // read-only (초대값)
  teamId: string | null; // read-only (초대값)
  teamName: string; // read-only (초대값)
  managerId: string | null; // read-only (초대값)
  position: string; // read-only (초대값)
  name: string;
  password: string;
  passwordConfirm: string;
  phone: string;
  joinedAt: string; // yyyy-mm-dd

  /* Step 2 — 프로필 · 파일 */
  profileImageFile: File | null;
  signatureFile: File | null;
  extensionNumber: string;

  /* Step 3 — 담당 업무 */
  tasks: string[];
  agreeTerms: boolean;
}

/** useSignUp 이 실제 제출 시 받는 페이로드 */
export interface SignUpPayload extends SignUpFormValues {
  invite: InviteDoc;
}

export interface SignUpResult {
  uid: string;
  status: UserStatus;
  requireApproval: boolean;
}
