// apps/patient-app/src/lib/televisit/consent.ts
import { sha256Hex } from './security';

export const TELEVISIT_CONSENT_VERSION = '2025-12-20.v1';

/**
 * POPIA + HIPAA-aligned Televisit Informed Consent + Privacy Notice.
 * Keep this as the single canonical text. UI renders it, server hashes it.
 */
export const TELEVISIT_CONSENT_TEXT = `
AMBULANT+ TELEVISIT INFORMED CONSENT, PRIVACY NOTICE & DATA USE (POPIA / HIPAA-ALIGNED)

Effective date/version: ${TELEVISIT_CONSENT_VERSION}

1) PURPOSE AND SCOPE
You are about to participate in a remote healthcare consultation (“Televisit”) using the Ambulant+ platform. This Televisit may include audio/video, secure messaging, real-time streaming of health measurements (including from connected medical devices or wearables), and documentation required for clinical care. This notice explains how the Televisit works, what data is processed, your choices, and your rights.

2) CLINICAL LIMITATIONS & APPROPRIATENESS
Televisits are not appropriate for every condition. The clinician may determine that you require an in-person examination, additional testing, or urgent referral. Technical limitations (camera, lighting, network quality, device availability, and your environment) may affect clinical accuracy.

3) EMERGENCIES AND URGENT CARE
Televisits are not an emergency service. If you believe you are experiencing an emergency or are at immediate risk of serious harm, call your local emergency number or go to the nearest emergency facility. You are responsible for providing your correct location if emergency escalation is needed.

4) WHAT DATA WE PROCESS
Depending on your Televisit, Ambulant+ and authorized care team members may process:
• Identification and contact information you provide
• Appointment/encounter details (date/time, clinician identity, case reason)
• Audio/video streams and chat messages during the session
• Health measurements and observations (e.g., heart rate, SpO₂, blood pressure, temperature, device readings, symptom reports)
• Session metadata (timestamps, device type, network quality, participant join/leave events)
• Clinical notes, referrals, prescriptions, and related clinical documentation created during or after the Televisit

5) RECORDING (IF ENABLED)
A Televisit may be recorded only where permitted by applicable law and organizational policy, and only when recording is clearly indicated to you in the user interface. If recording is enabled, the recording may include audio/video, shared content, and chat/captions. Recordings (where applicable) are retained only for the period necessary for clinical, legal, quality, safety, training, or audit purposes, and are access-controlled. You may decline recording where the platform provides that option; in some jurisdictions or care programs, recording may be required for compliance—if so, you will be informed.

6) PRIVACY, CONFIDENTIALITY & SECURITY SAFEGUARDS
We implement administrative, technical, and physical safeguards designed to protect confidentiality, integrity, and availability, which may include: encrypted transport, access controls, audit logging, least-privilege staff access, and incident response procedures. No system is risk-free; residual risks include unauthorized access due to phishing, compromised devices, misdirected communications, or third-party compromise. You can reduce risk by using a private space, secure networks, up-to-date devices, and not sharing your access credentials.

7) CROSS-BORDER PROCESSING AND TRANSFERS
Ambulant+ may operate across countries and may use reputable cloud and service providers. Where cross-border processing occurs, we apply contractual, organizational, and technical protections intended to meet applicable requirements (including POPIA conditions for lawful processing and appropriate transfer safeguards, and HIPAA business associate arrangements where applicable). Your data may be stored or processed in jurisdictions with different privacy laws; we apply a consistent high standard of protection.

8) LAWFUL BASIS FOR PROCESSING
We process personal information and health information for the purpose of providing healthcare services, fulfilling contractual obligations, meeting legal and regulatory requirements, and protecting patient safety and system integrity. Where consent is required or relied upon (e.g., certain telehealth consent rules, optional features such as recording or AI assistance), you will be asked to provide it and it will be recorded.

9) AI ASSISTANCE (IF PRESENT)
Some features may use automated systems (including AI) to support care operations (e.g., summarization, trend detection, triage prompts, clinician decision support). These tools do not replace a qualified clinician’s judgment. Where required, we provide appropriate transparency and human oversight.

10) YOUR RIGHTS AND CHOICES
Subject to applicable law and clinical recordkeeping obligations, you may have rights to:
• Access or obtain a copy of your information
• Request correction of inaccurate information
• Request restrictions or object to certain processing
• Request deletion where lawful and feasible (clinical records may be retained as required)
• Withdraw optional consents (such as recording) prospectively
To exercise rights or ask questions, contact the Ambulant+ Privacy/Information Officer through your organization’s published channels.

11) PATIENT RESPONSIBILITIES
You agree to:
• Provide accurate information to the best of your ability
• Participate from a private, safe location where feasible
• Not record the session without consent where prohibited by law or policy
• Follow clinician instructions and seek in-person care when advised

12) MINORS AND DEPENDENTS
If the patient is a minor or otherwise lacks legal capacity, a parent/legal guardian or authorized representative may be required to consent, subject to local healthcare consent laws. Where you are acting as a representative, you confirm you have lawful authority to do so.

13) ACKNOWLEDGEMENT
By selecting “I Consent” you acknowledge that you have read and understood this notice, you have had an opportunity to ask questions, and you voluntarily consent to participate in the Televisit under these terms.

END OF NOTICE
`.trim();

export function televisitConsentDocHash() {
  return sha256Hex(TELEVISIT_CONSENT_TEXT);
}

/**
 * Default scopes recorded in DB. Keep explicit.
 * You can extend this over time without breaking historical records.
 */
export function defaultTelevisitConsentScopes(args: {
  recordingAllowed: boolean;
  aiAssistanceAllowed: boolean;
  deviceStreamingAllowed: boolean;
}) {
  return {
    telehealth: true,
    privacyNotice: true,
    recordingAllowed: !!args.recordingAllowed,
    aiAssistanceAllowed: !!args.aiAssistanceAllowed,
    deviceStreamingAllowed: !!args.deviceStreamingAllowed,
    crossBorderNotice: true,
  };
}
