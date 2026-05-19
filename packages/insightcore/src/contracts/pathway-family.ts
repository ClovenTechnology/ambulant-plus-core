export interface PathwayFamilyMember {
  id: string;
  version: string;
  title: string;
  kind: 'deployment' | 'research';
}

export interface PathwayFamily {
  id: string;
  version: string;
  title: string;
  description: string;
  members: PathwayFamilyMember[];
}