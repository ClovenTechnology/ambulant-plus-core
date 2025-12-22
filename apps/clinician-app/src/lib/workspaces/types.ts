/*
This canvas contains MULTIPLE FILES. Copy each section into the indicated path.
All code is standalone and matches the minimal POST-only contracts:
- POST /findings
- POST /evidence
- POST /annotations


Assumptions:
- Next.js app router
- Tailwind available
- Existing absolute imports with @/ alias


============================================================
FILE 1: apps/clinician-app/src/lib/workspaces/types.ts
============================================================
*/


export type Specialty = 'dental' | 'physio' | 'ent' | 'optometry';


export type EvidenceStatus = 'ready' | 'processing' | 'failed';


export type EvidenceKind = 'image' | 'video_clip';


export type Location =
| { kind: 'dental_tooth'; toothId: string; surface?: string }
| { kind: 'ent_ear'; ear: 'L' | 'R'; zoneId?: string }
| { kind: 'eye'; eye: 'OD' | 'OS'; zoneId?: string }
| { kind: 'physio_body'; regionId: string; side?: 'L' | 'R' | 'midline'; view: 'front' | 'back' | 'left' | 'right' };


export type FindingStatus = 'draft' | 'final';


export type Finding = {
id: string;
patientId: string;
encounterId: string;
specialty: Specialty;
status: FindingStatus;
title: string;
note?: string;
severity?: 'mild' | 'moderate' | 'severe';
tags?: string[];
location: Location;
meta?: Record<string, any>;
createdAt: string;
updatedAt: string;
createdBy?: string;
};


export type Evidence = {
id: string;
patientId: string;
encounterId: string;
specialty: Specialty;
findingId?: string | null;
location: Location;


kind: EvidenceKind;
device: 'otoscope' | 'camera' | 'upload' | 'other';
status: EvidenceStatus;


// time
capturedAt: string; // ISO
startTs?: number; // ms epoch, for clips
endTs?: number; // ms epoch, for clips


// media pointers
url: string;
thumbnailUrl?: string;
contentType?: string;


// async processing
};