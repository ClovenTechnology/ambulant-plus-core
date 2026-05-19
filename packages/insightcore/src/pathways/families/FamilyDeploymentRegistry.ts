import type { PathwayFamily } from '../../contracts/pathway-family';

export interface FamilyDeploymentRecord {
  id: string;
  title: string;
  class: 'deployment' | 'research' | 'mixed';
  members: string[];
}

export class FamilyDeploymentRegistry {
  list(families: PathwayFamily[]): FamilyDeploymentRecord[] {
    return families.map((family) => {
      const kinds = new Set(family.members.map((m) => m.kind));
      const familyClass =
        kinds.size === 1
          ? (kinds.has('research') ? 'research' : 'deployment')
          : 'mixed';

      return {
        id: family.id,
        title: family.title,
        class: familyClass,
        members: family.members.map((m) => m.id),
      };
    });
  }
}