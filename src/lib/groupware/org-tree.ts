/**
 * 조직도 트리 · 편제(본부/팀) 계산.
 *
 * 사람은 `users`(+ 가계정) 컬렉션, 편제는 `teams` 컬렉션이 단일 소스입니다.
 * `teams.parentId` 로 본부(최상위) - 팀(그 밑) 2단 계층을 구성하고, 사람은
 * `teamId` 로 소속 팀에 배정됩니다. 대표이사(최상위)는 `boss === null` 인
 * 사람으로 판정합니다 — 특정 id 값을 하드코딩하지 않습니다.
 */
import type { Person } from "./data";
import type { TeamDoc } from "./firestore";

export interface DeptTreeRow {
  name: string;
  count: number;
  depth: number;
  key: string; // team id, 최상위는 "전체"
}

export interface OrgBranch {
  headId: string | null; // 그 본부에 배정된, CEO 직속 인물의 id (없으면 null)
  divisionId: string;
  divisionName: string;
  teams: { id: string; name: string; count: number }[];
}

export const ROOT_FILTER = "전체";

export interface DeptFilterOption {
  key: string;
  name: string;
}

export function buildOrgStructure(
  people: Person[],
  teams: TeamDoc[],
  rootLabel: string,
): { deptTree: DeptTreeRow[]; branches: OrgBranch[]; filters: DeptFilterOption[] } {
  const ceo = people.find((p) => p.boss === null) ?? null;
  const divisions = teams
    .filter((t) => t.parentId === null)
    .sort((a, b) => a.order - b.order);

  const countOf = (teamId: string, includeChildren: boolean) => {
    if (!includeChildren) return people.filter((p) => p.teamId === teamId).length;
    const childIds = teams.filter((t) => t.parentId === teamId).map((t) => t.id);
    return people.filter(
      (p) => p.teamId === teamId || (p.teamId && childIds.includes(p.teamId)),
    ).length;
  };

  const deptTree: DeptTreeRow[] = [
    { name: rootLabel, count: people.length, depth: 0, key: ROOT_FILTER },
  ];
  const branches: OrgBranch[] = [];
  const filters: DeptFilterOption[] = [{ key: ROOT_FILTER, name: rootLabel }];

  for (const division of divisions) {
    deptTree.push({
      name: division.name,
      count: countOf(division.id, true),
      depth: 1,
      key: division.id,
    });
    filters.push({ key: division.id, name: division.name });

    const childTeams = teams
      .filter((t) => t.parentId === division.id)
      .sort((a, b) => a.order - b.order);
    for (const t of childTeams) {
      deptTree.push({ name: t.name, count: countOf(t.id, false), depth: 2, key: t.id });
      filters.push({ key: t.id, name: t.name });
    }

    const head =
      people.find((p) => p.teamId === division.id && p.boss === ceo?.id) ?? null;
    branches.push({
      headId: head?.id ?? null,
      divisionId: division.id,
      divisionName: division.name,
      teams: childTeams.map((t) => ({
        id: t.id,
        name: t.name,
        count: countOf(t.id, false),
      })),
    });
  }

  return { deptTree, branches, filters };
}

/** 선택한 필터 key(팀/본부 id, 또는 "전체")에 사람이 속하는지 판정 */
export function personMatchesDeptFilter(
  person: Person,
  filterKey: string,
  teams: TeamDoc[],
): boolean {
  if (filterKey === ROOT_FILTER) return true;
  if (person.teamId === filterKey) return true;
  const team = teams.find((t) => t.id === person.teamId);
  return team?.parentId === filterKey;
}
