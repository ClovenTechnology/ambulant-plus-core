import { ExperimentRegistry } from './ExperimentRegistry';

export class ExperimentResolver {
  constructor(private readonly registry = new ExperimentRegistry()) {}

  activeIds(): string[] {
    return this.registry.list().filter((e) => e.active).map((e) => e.id);
  }
}