/**
 * 조직도 트리 · 편제(본부/팀) 계산.
 *
 * `orgPeople` 문서에는 별도의 "부서" 컬렉션이 없고, 각 인물의 `boss`(직속
 * 상사 id) · `dept`("본부 · 팀" 또는 본부명) · `team` 필드만 있습니다. 이
 * 필드들로부터 사이드바 부서 트리와 조직도 트리뷰의 본부/팀 편제를 실시간
 * 계산합니다 — 어떤 조직 데이터가 들어오든(데모든 실제 회사든) 항상 실제
 * 인원 수·구조와 일치합니다.
 */
import type { Person } from "./data";

export interface DeptTreeRow {
  name: string;
  count: number;
  depth: number;
  key: string;
}

export interface OrgBranch {
  head: number;
  dept: string;
  teams: [string, number][];
}

const DIVIDER = " · ";

export function buildOrgStructure(
  people: Person[],
  rootLabel: string,
): { deptTree: DeptTreeRow[]; branches: OrgBranch[]; filters: string[] } {
  const ceo = people.find((p) => p.boss === null) ?? null;

  const divisionHeads = ceo
    ? people.filter(
        (p) =>
          p.boss === ceo.id && p.id !== ceo.id && !p.dept.includes(DIVIDER),
      )
    : [];

  const deptTree: DeptTreeRow[] = [
    { name: rootLabel, count: people.length, depth: 0, key: "전체" },
  ];
  const branches: OrgBranch[] = [];
  const filters = ["전체"];

  for (const head of divisionHeads) {
    const division = head.dept;
    const members = people.filter(
      (p) => p.dept === division || p.dept.startsWith(division + DIVIDER),
    );
    deptTree.push({ name: division, count: members.length, depth: 1, key: division });

    const teamNames: string[] = [];
    for (const p of members) {
      if (p.dept.startsWith(division + DIVIDER) && !teamNames.includes(p.team)) {
        teamNames.push(p.team);
      }
    }
    const teams: [string, number][] = teamNames.map((team) => [
      team,
      members.filter((p) => p.team === team).length,
    ]);
    for (const [team, count] of teams) {
      deptTree.push({ name: team, count, depth: 2, key: team });
      filters.push(team);
    }
    branches.push({ head: head.id, dept: division, teams });
  }

  return { deptTree, branches, filters };
}
