# CoreFlow (코어플로우)

> **모든 업무의 중심을 잇다**
>
> 출퇴근 기록부터 전자결재, 프로젝트 관리, 조직도까지 — 파편화된 기업의 핵심
> 업무(Core)를 끊김 없는 하나의 흐름(Flow)으로 연결하는 B2B 그룹웨어.

이 저장소는 CoreFlow의 **[초대 링크 기반 회원가입 · 사용자 데이터 수집 시스템]** 구현입니다.

## 스택

| 영역 | 사용 기술 |
| --- | --- |
| 프레임워크 | Next.js 16 (App Router) · React 19 · TypeScript |
| 스타일 | Tailwind CSS v4 · shadcn/ui 패턴 컴포넌트 · Pretendard |
| 아이콘 | lucide-react |
| 백엔드 | Firebase v10+ Modular SDK (Auth · Cloud Firestore · Storage) |

## 시작하기

```bash
cp .env.local.example .env.local   # Firebase 웹 앱 설정값 입력
npm install
npm run dev                        # http://localhost:3000
```

### Firebase 준비

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성
2. **Authentication → 로그인 방법 → 이메일/비밀번호** 사용 설정
3. **Cloud Firestore** 생성 (프로덕션 모드)
4. **Storage** 생성
5. 웹 앱 등록 후 설정값을 `.env.local` 에 입력
6. 보안 규칙 배포

```bash
firebase deploy --only firestore:rules,storage
```

## 가입 프로세스

```
관리자가 초대 발급  →  /signup?token=xxx  →  3-Step 위저드  →  users/{uid} 생성
       │                      │                    │                   │
   invites 문서 생성   invites 컬렉션에서 토큰 조회   Step1 계정 / Step2 프로필·서명 / Step3 업무태그
                       이메일·사번·부서·직급 Read-only        │
                                                    invites.status = 'COMPLETED'
```

- 초대에 `requireApproval: true` 이면 가입 후 `status: 'PENDING'` (관리자 승인 대기)
- `requireApproval: false` 이면 즉시 `status: 'ACTIVE'`

### 데모용 초대 생성

`/admin/invite` 에서 초대 정보를 입력하면 `invites` 문서와 가입 링크가 생성됩니다.
(⚠️ 데모용 — 운영에서는 관리자 인증/서버 로직으로 보호하세요.)

## 주요 파일

| 경로 | 설명 |
| --- | --- |
| `src/lib/firebase.ts` | Firebase Modular SDK 초기화 |
| `src/types/user.ts` | `UserDoc` · `InviteDoc` · 폼 타입 |
| `src/hooks/useInvite.ts` | `?token` → `invites` 조회 · 만료/사용 검증 |
| `src/hooks/useSignUp.ts` | Auth 생성 → Storage 업로드 → Firestore 저장(batch) |
| `src/hooks/useAuthUser.ts` | 로그인 사용자 + `users/{uid}` 프로필 |
| `src/components/signup/*` | 3단계 Stepper 위저드 UI |
| `src/app/signup/page.tsx` | 회원가입 화면 |
| `src/app/login/page.tsx` | 로그인 화면 |
| `src/app/dashboard/page.tsx` | 가입 후 프로필 대시보드 |

## 데이터 모델 (Firestore)

### `users/{uid}` — 문서 ID = Firebase Auth `uid`

```ts
{
  email, name,                    // 계정
  departmentId, position,         // 조직
  employeeId, joinedAt, phone,    // 근태·보안
  profileImageUrl?, extensionNumber?, tasks?, signatureUrl?,  // 선택
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER',
  status: 'INVITED' | 'PENDING' | 'ACTIVE' | 'SUSPENDED',
  inviteId, createdAt, updatedAt
}
```

### `invites/{inviteId}`

```ts
{
  token, email, employeeId, departmentId, departmentName, position,
  role, status: 'INVITED' | 'PENDING' | 'COMPLETED' | 'EXPIRED',
  requireApproval, invitedBy, invitedByName,
  createdAt, expiresAt, completedUid, completedAt
}
```

## Storage 구조

```
users/{uid}/profile.<ext>      프로필 이미지
users/{uid}/signature.<ext>    전자결재용 서명/직인
```
