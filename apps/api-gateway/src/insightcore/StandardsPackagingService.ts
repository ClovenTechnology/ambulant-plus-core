import { FhirBundleProjector } from '../../../../packages/insightcore/src/fhir/FhirBundleProjector';
import { FhirEpisodeProjector } from '../../../../packages/insightcore/src/fhir/FhirEpisodeProjector';
import { OmopProjectionMapper } from '../../../../packages/insightcore/src/omop/OmopProjectionMapper';
import { OmopEpisodeProjection } from '../../../../packages/insightcore/src/omop/OmopEpisodeProjection';
import { FhirResearchEnvelope } from '../../../../packages/insightcore/src/standards/FhirResearchEnvelope';
import { FhirDeploymentEnvelope } from '../../../../packages/insightcore/src/standards/FhirDeploymentEnvelope';
import { OmopResearchEnvelope } from '../../../../packages/insightcore/src/standards/OmopResearchEnvelope';
import { OmopDeploymentEnvelope } from '../../../../packages/insightcore/src/standards/OmopDeploymentEnvelope';
import { OmopBaselineProjection } from '../../../../packages/insightcore/src/omop/OmopBaselineProjection';

export class StandardsPackagingService {
  build(args: {
    patientId: string;
    result: any;
    baselineState: any;
    execution?: any;
  }) {
    const fhir = new FhirBundleProjector().map(args.result.featureVector);
    const fhirEpisodeProjection = new FhirEpisodeProjector().map(args.result.episodes || []);
    const omop = new OmopProjectionMapper().map(args.result.featureVector);
    const omopEpisodeProjection = new OmopEpisodeProjection().map(args.result.episodes || []);

    const deploymentEnvelope = new FhirDeploymentEnvelope().build({
      patientId: args.patientId,
      deploymentIssues: fhirEpisodeProjection.filter(
        (issue: any) => !String(issue?.detail || '').includes('research'),
      ),
      observations: [],
    });

    const researchEnvelope = new FhirResearchEnvelope().build({
      patientId: args.patientId,
      researchIssues: (args.result.researchInferences || []).map((inf: any) => ({
        resourceType: 'DetectedIssue',
        status: 'preliminary',
        code: { text: inf.model },
        detail: (inf.rationale || []).join(' | '),
      })),
    });

    const omopDeploymentEnvelope = new OmopDeploymentEnvelope().build({
      patientId: args.patientId,
      baseline: new OmopBaselineProjection().map(args.baselineState),
      episodes: omopEpisodeProjection,
    });

    const omopResearchEnvelope = new OmopResearchEnvelope().build({
      patientId: args.patientId,
      experiments: args.execution?.lineage?.experiments || [],
      researchSignals: args.result.researchInferences || [],
    });

    return {
      fhir,
      omop,
      fhirEpisodeProjection,
      omopEpisodeProjection,
      deploymentEnvelope,
      researchEnvelope,
      omopDeploymentEnvelope,
      omopResearchEnvelope,
    };
  }
}