import { PathwayFamilyRegistry } from './PathwayFamilyRegistry';

export class FamilyExecutionPlanner {
  private registry = new PathwayFamilyRegistry();

  plan() {
    return this.registry.list().map((family) => ({
      id: family.id,
      title: family.title,
      memberIds: family.members.map((m) => m.id),
      researchMembers: family.members.filter((m) => m.kind === 'research').map((m) => m.id),
      deploymentMembers: family.members.filter((m) => m.kind === 'deployment').map((m) => m.id),
    }));
  }
}