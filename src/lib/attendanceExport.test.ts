import { describe, expect, it } from "vitest";
import { buildExportRows, classifyDay, csvCell, dateRange, hhmm, netWorkHours, toCsv } from "./attendanceExport";

const KST = "Asia/Seoul";
/** KST "yyyy-mm-dd HH:MM" → ms */
const kst = (s: string) => Date.parse(`${s.replace(" ", "T")}:00+09:00`);

describe("시간대·근무시간", () => {
  it("서버(UTC)에서도 요청한 시간대로 시각을 계산", () => {
    expect(hhmm(kst("2026-11-10 08:55"), KST)).toBe("08:55");
    expect(hhmm(kst("2026-11-10 00:05"), KST)).toBe("00:05");
  });

  it("휴게시간을 빼고 지각·연장·미퇴근을 구분", () => {
    expect(netWorkHours(9)).toBe(8);
    expect(netWorkHours(5)).toBe(4.5);
    const day = (i: string, o: string | null) => ({
      date: "2026-11-10",
      inMs: kst(`2026-11-10 ${i}`),
      outMs: o ? kst(`2026-11-10 ${o}`) : null,
    });
    expect(classifyDay(day("09:00", "18:00"), KST)).toMatchObject({ hours: 8, type: "정상" });
    expect(classifyDay(day("09:01", "18:00"), KST)?.type).toBe("지각");
    expect(classifyDay(day("08:00", "19:00"), KST)).toMatchObject({ hours: 10, type: "연장" });
    expect(classifyDay(day("09:00", null), KST)).toMatchObject({ out: "", type: "미퇴근" });
  });
});

describe("기간", () => {
  it("끝 날 포함, 월·연 경계", () => {
    expect(dateRange("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
  it("거꾸로·없는 날짜·366일 초과는 null", () => {
    expect(dateRange("2026-11-10", "2026-11-01")).toBeNull();
    expect(dateRange("2026-02-30", "2026-03-01")).toBeNull();
    expect(dateRange("2026-01-01", "2027-01-02")).toBeNull();
  });
});

describe("CSV", () => {
  it("엑셀 수식 실행 방지와 따옴표 이스케이프", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('김 "철수", 팀장')).toBe('"김 ""철수"", 팀장"');
    expect(csvCell(8.5)).toBe("8.5");
  });
  it("BOM 으로 시작", () => {
    expect(toCsv([["a"]]).charCodeAt(0)).toBe(0xfeff);
  });
});

describe("행 만들기", () => {
  const people = [
    { uid: "u1", name: "김철수", employeeId: "E1", dept: "개발", position: "매니저", resigned: false },
    { uid: "u2", name: "이영희", employeeId: "E2", dept: "개발", position: "팀장", resigned: true },
  ];
  const dates = dateRange("2026-11-09", "2026-11-15")!; // 월~일
  const days = new Map([
    [
      "u1",
      [
        { date: "2026-11-09", inMs: kst("2026-11-09 09:30"), outMs: kst("2026-11-09 18:30") },
        { date: "2026-11-10", inMs: kst("2026-11-10 08:00"), outMs: kst("2026-11-10 20:00") },
      ],
    ],
  ]);
  const leaves = [
    { uid: "u1", kind: "연차", start: "2026-11-12", end: "2026-11-16", days: 3, hours: 0 },
    { uid: "u1", kind: "초과근무", start: "2026-11-10", end: "2026-11-10", days: 0, hours: 2 },
    { uid: "u2", kind: "반차", start: "2026-11-11", end: "2026-11-11", days: 0.5, hours: 0 },
  ];

  it("일별: 기록이나 휴가가 있는 날만", () => {
    const rows = buildExportRows("daily", people, days, leaves, dates, KST);
    expect(rows.slice(1).map((r) => [r[0], r[1], r[8], r[9]])).toEqual([
      ["2026-11-09", "김철수", "지각", ""],
      ["2026-11-10", "김철수", "연장", "초과근무 2h"],
      ["2026-11-12", "김철수", "", "연차"],
      ["2026-11-13", "김철수", "", "연차"],
      ["2026-11-14", "김철수", "", "연차"],
      ["2026-11-15", "김철수", "", "연차"],
      ["2026-11-11", "이영희 (퇴사)", "", "반차"],
    ]);
  });

  it("요약: 휴가는 기간 안 평일만, 반차는 0.5일", () => {
    const [, u1, u2] = buildExportRows("summary", people, days, leaves, dates, KST);
    // 근무일수, 총 근무시간, 지각, 연장, 미퇴근, 휴가일수, 초과근무 신청
    expect(u1.slice(4)).toEqual([2, 19, 1, 1, 0, 2, 2]);
    expect(u2.slice(4)).toEqual([0, 0, 0, 0, 0, 0.5, 0]);
  });
});
