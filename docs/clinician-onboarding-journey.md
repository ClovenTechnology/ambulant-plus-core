# Ambulant+ Clinician Onboarding Journey

_Last updated: 2026-06-13_

## Purpose

This document defines the operational pathway for onboarding clinicians onto Ambulant+. It is the source of truth for the clinician handbook, admin workflows, payment handling, mandatory training, simulation-mode readiness, and final activation.

## Core doctrine

Ambulant+ separates clinician progression into four gates:

1. Account access.
2. Training access.
3. Simulation workspace access.
4. Final real-patient marketplace visibility.

Training completion does not automatically mean public patient visibility.

## Journey overview

The clinician onboarding journey is:

1. Clinician signs up.
2. Admin reviews the onboarding profile.
3. Clinician pays the full fee or minimum initial deposit, or Admin confirms EFT/direct deposit.
4. Admin generates or validates payment authorisation where required.
5. Starter kit dispatch is prepared.
6. Admin schedules mandatory training.
7. Clinician attends training individually or as part of a cohort.
8. Admin marks training completed.
9. Certificate metadata is issued.
10. Clinician enters Simulation Mode.
11. Clinician completes supervised test Televisits with test patient accounts.
12. Admin reviews readiness.
13. Clinician becomes visible to real patients only after final readiness approval.

## Payment model

Current onboarding fee model:

- Full onboarding fee: R26,500
- Minimum initial deposit: R7,950
- Currency: ZAR
- Card provider: Paystack
- Manual options: EFT/direct bank deposit with Admin confirmation

Payment routes:

1. Paystack full payment.
2. Paystack minimum deposit.
3. EFT/direct deposit confirmed by Admin.
4. Admin-issued authorisation code after manual payment verification.

Authorisation codes are generated from:

Admin Dashboard -> Admin Clinicians -> Onboarding & Dispatch

Calendar is for training logistics. Onboarding & Dispatch is for payment, authorisation, starter kit, and readiness operations.

## Bank accounts

The platform should support multiple bank accounts.

Recommended structure:

- bankName
- accountName
- accountNumber
- branchCode
- swiftCode
- referenceInstruction
- isPrimary
- active

Clinician-facing pages should show the primary active account unless Admin selects otherwise.

## Training scheduling

Training can be virtual or in-person.

Virtual training links are generated automatically. Admin should not manually type Join URLs.

Cohort training supports:

- multi-select clinicians
- one shared training slot
- one shared room ID
- one shared clinician join URL
- admin/trainer access
- observer access
- participant list

Observers do not count as trainees.

## Training completion

When Admin marks training completed, the platform must update:

- onboarding.status = training_completed
- clinician.trainingCompleted = true
- rawProfile.onboarding.stage = training_completed
- rawProfile.training.status = completed
- rawProfile.training.completedAt = ISO timestamp
- rawProfile.training.certificateNumber = generated certificate number
- rawProfile.trainingCertificate = issued certificate metadata

## Certificate meaning

The certificate confirms Ambulant+ platform onboarding and workflow-readiness training.

It does not replace:

- statutory professional registration
- employer credentialing
- specialist qualification
- independent clinical competency assessment

Safe wording:

The clinician has been trained in the safe, ethical, clinician-supervised use of AI-assisted workflow tools within the Ambulant+ platform, including voice-to-text clinical dictation with mandatory clinician review, correction, and sign-off before saving or submission.

## Simulation Mode

After training completion and certificate issuance, the clinician enters Simulation Mode.

Simulation Mode means:

- trainingCompleted = true
- simulationMode = true
- canPractice = true
- visibleToPatients = false

Simulation Mode gives workspace access without exposing the clinician to real patient bookings.

## Supervised test Televisits

Each clinician should complete three supervised test Televisits before final readiness.

These test sessions should be:

- free/internal test sessions
- visible only to approved test patient accounts
- excluded from real patient marketplace discovery
- excluded from claims and payouts
- marked as simulation/test encounters
- reviewed by Admin or training lead

## Test Televisit checklist

Each clinician must test:

- audio/video join
- patient context
- live vitals
- 6-in-1 Health Monitor
- NexRing
- Digital Stethoscope
- HD Otoscope
- ICD-10 search
- RxNorm search
- NAPPI normalisation where applicable
- Dictate button
- mandatory clinician review/sign-off
- notes
- prescriptions/eRx where applicable
- internal referrals
- external referrals by email with session summary
- follow-up booking
- discharge/end session
- encounter audit trail

## Final readiness

A clinician becomes visible to real patients only after:

1. Training completed.
2. Certificate issued.
3. Simulation Mode enabled.
4. Three supervised test Televisits completed.
5. IoMT workflow tested.
6. Documentation workflow tested.
7. Prescribing/referral/follow-up workflow tested.
8. Admin or training lead approves final readiness.

Final live state:

- clinician.status = active
- visibleToPatients = true
- simulationMode = false

## Launch-safe gate summary

| Gate | Login | Workspace | Real patient visibility |
|---|---:|---:|---:|
| Signed up | Yes | No | No |
| Payment pending | Yes | No | No |
| Training scheduled | Yes | Training page only | No |
| Training completed/certified | Yes | Simulation Mode | No |
| Test Televisits passed | Yes | Yes | Pending final approval |
| Final readiness approved | Yes | Yes | Yes |

## Immediate engineering backlog

1. Add participant to existing training cohort.
2. Generate certificate PDF dynamically.
3. Add test patient pool.
4. Add three supervised test Televisit requirement.
5. Add Paystack full/minimum deposit flow.
6. Add EFT confirmation and authorisation code workflow.
7. Add multiple bank accounts.
8. Add final readiness approval gate.
9. Keep real patient marketplace visibility separate from Simulation Mode.
