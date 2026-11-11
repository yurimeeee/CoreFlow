/**
 * 근태 CSV 내보내기 — 서버(/api/admin/attendance-export)가 쓰는 순수 함수.
 *
 * 서버는 UTC 로 돌기 때문에 시각을 그대로 getHours() 하면 한국 시간과 9시간
 * 어긋납니다. 요청한 관리자의 시간대(IANA 이름)로 날짜·시각을 계산합니다.
 * 근무시간·지각·연장 기준은 화면(buildAttendanceRows)과 같습니다.
 */

export type ExportKind = "daily" | "summary";

export interface ExportPerson {
  uid: string;
  name: string;
  employeeId: string;
  dept: string;
  position: string;
  resigned: boolean;
}

export interface ExportDay {
  date: string; // yyyy-mm-dd
  inMs: number | null;
  outMs: number | null;
}

export interface ExportLeave {
  uid: string;
  kind: string;
  start: string;
  end: string;
  days: number;
  hours: number;
}

/** 최대 조회 기간(일) */
export const MAX_EXPORT_DAYS = 366;

/** 휴게시간(4시간 이상 30분, 8시간 이상 1시간)을 뺀 실근무 시간, 소수 첫째 자리 */
export function netWorkHours(rawHours: number): number {
  const h = Math.max(0, rawHours);
  return Math.round((h - (h >= 8 ? 1 : h >= 4 ? 0.5 : 0)) * 10) / 10;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** ms → 그 시간대의 "HH:MM" */
export function hhmm(ms: number, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function utcDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** start~end(포함) 날짜 목록. 형식이 틀리거나 거꾸로거나 너무 길면 null */
export function dateRange(start: string, end: string): string[] | null {
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) return null;
  const out: string[] = [];
  for (let t = utcDate(start).getTime(); t <= utcDate(end).getTime(); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
    if (out.length > MAX_EXPORT_DAYS) return null;
  }
  return out[0] === start ? out : null;
}

const isWeekend = (date: string) => {
  const w = utcDate(date).getUTCDay();
  return w === 0 || w === 6;
};

/** 하루 기록 → 근무시간·구분. 아직 퇴근 기록이 없으면 "미퇴근" */
export function classifyDay(d: ExportDay, tz: string) {
  if (d.inMs == null) return null;
  const inAt = hhmm(d.inMs, tz);
  if (d.outMs == null) return { in: inAt, out: "", hours: null as number | null, type: "미퇴근" };
  const hours = netWorkHours((d.outMs - d.inMs) / 3_600_000);
  const late = inAt > "09:00";
  return { in: inAt, out: hhmm(d.outMs, tz), hours, type: hours > 8 ? "연장" : late ? "지각" : "정상" };
}

/** 그 날짜에 걸친 승인 휴가·초과근무 신청 */
function leavesOn(leaves: ExportLeave[], uid: string, date: string) {
  return leaves.filter((l) => l.uid === uid && l.start <= date && date <= l.end);
}

function leaveLabel(l: ExportLeave) {
  return l.kind === "초과근무" ? `초과근무 ${l.hours}h` : l.kind;
}

/** 엑셀이 수식으로 실행하지 않도록(=, +, -, @ 로 시작) 앞에 ' 를 붙이고 따옴표로 감쌉니다 */
export function csvCell(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null)[][]): string {
  // BOM — 엑셀이 UTF-8 한글을 깨뜨리지 않게
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/**
 * 일별: 사람 × 날짜마다 출퇴근 또는 휴가가 있는 날만 한 줄.
 * 요약: 사람마다 근무일수·총 근무시간·지각·연장·미퇴근·휴가일수·초과근무 신청 시간.
 */
export function buildExportRows(
  kind: ExportKind,
  people: ExportPerson[],
  daysByUid: Map<string, ExportDay[]>,
  leaves: ExportLeave[],
  dates: string[],
  tz: string,
): (string | number | null)[][] {
  const who = (p: ExportPerson) => [p.name + (p.resigned ? " (퇴사)" : ""), p.employeeId, p.dept, p.position];

  if (kind === "daily") {
    const rows: (string | number | null)[][] = [
      ["날짜", "이름", "사번", "부서", "직급", "출근", "퇴근", "근무시간(h)", "구분", "휴가·신청"],
    ];
    for (const p of people) {
      const byDate = new Map((daysByUid.get(p.uid) ?? []).map((d) => [d.date, d]));
      for (const date of dates) {
        const day = byDate.get(date);
        const c = day ? classifyDay(day, tz) : null;
        const lv = leavesOn(leaves, p.uid, date).map(leaveLabel).join(" / ");
        if (!c && !lv) continue;
        rows.push([date, ...who(p), c?.in ?? "", c?.out ?? "", c?.hours ?? "", c?.type ?? "", lv]);
      }
    }
    return rows;
  }

  const rows: (string | number | null)[][] = [
    ["이름", "사번", "부서", "직급", "근무일수", "총 근무시간(h)", "지각", "연장", "미퇴근", "휴가일수", "초과근무 신청(h)"],
  ];
  const inRange = new Set(dates);
  for (const p of people) {
    let worked = 0;
    let hours = 0;
    let late = 0;
    let overtime = 0;
    let open = 0;
    for (const d of daysByUid.get(p.uid) ?? []) {
      if (!inRange.has(d.date)) continue;
      const c = classifyDay(d, tz);
      if (!c) continue;
      worked++;
      hours += c.hours ?? 0;
      if (c.type === "지각") late++;
      if (c.type === "연장") overtime++;
      if (c.type === "미퇴근") open++;
    }
    let leaveDays = 0;
    let otHours = 0;
    for (const l of leaves) {
      if (l.uid !== p.uid) continue;
      const covered = dates.filter((d) => l.start <= d && d <= l.end);
      if (covered.length === 0) continue;
      // 초과근무는 신청 시작일이 기간 안일 때 한 번만 셉니다
      if (l.kind === "초과근무") {
        if (inRange.has(l.start)) otHours += l.hours;
        continue;
      }
      // 반차 등 하루 미만은 그 일수, 여러 날 휴가는 기간 안의 평일 수
      leaveDays += l.days < 1 ? l.days : covered.filter((d) => !isWeekend(d)).length;
    }
    rows.push([...who(p), worked, Math.round(hours * 10) / 10, late, overtime, open, leaveDays, otHours]);
  }
  return rows;
}
