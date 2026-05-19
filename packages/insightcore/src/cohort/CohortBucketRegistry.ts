export class CohortBucketRegistry {
  list() {
    return [
      { id: 'general', title: 'General population' },
      { id: 'maternal', title: 'Maternal cohort' },
      { id: 'chronic', title: 'Chronic care cohort' },
      { id: 'research', title: 'Research cohort' },
    ];
  }
}