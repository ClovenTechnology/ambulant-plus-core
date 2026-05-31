export type BlogSection = {
  heading: string;
  body: string[];
  bullets?: string[];
  callout?: string;
};

export type BlogFaq = {
  question: string;
  answer: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  category: string;
  date: string;
  readTime: string;
  image: string;
  imageAlt: string;
  keywords: string[];
  sections: BlogSection[];
  faqs: BlogFaq[];
  relatedLinks: Array<{
    label: string;
    href: string;
  }>;
};

export const blogPosts: BlogPost[] = [
  {
    slug: "what-is-contactless-medicine",
    title: "What Is Contactless Medicine?",
    subtitle: "The next step beyond video-only telemedicine.",
    description:
      "Contactless Medicine is a clinician-led model of remote care that combines virtual consultation, connected medical devices, home diagnostics, medication fulfilment and governance-aware clinical intelligence.",
    category: "Contactless Medicine",
    date: "2026-06-01",
    readTime: "8 min read",
    image: "/visuals/home/ambulant-care-command-ecosystem.webp",
    imageAlt:
      "Ambulant+ Contactless Medicine ecosystem showing patient app, clinician workspace, connected devices, diagnostics, fulfilment and intelligence",
    keywords: [
      "Contactless Medicine",
      "contactless medicine South Africa",
      "telemedicine alternative",
      "remote patient monitoring",
      "IoMT healthcare",
      "connected medical devices",
      "home diagnostics",
      "pharmacy fulfilment",
      "virtual care with devices",
      "personal health management",
    ],
    sections: [
      {
        heading: "Contactless Medicine, defined simply",
        body: [
          "Contactless Medicine is remote healthcare supported by the clinical inputs that ordinary video calls often miss. It combines clinician-led virtual consultation with connected medical devices, structured patient information, home diagnostics, medication continuity and governance-aware intelligence.",
          "In practical terms, Contactless Medicine aims to make remote care more complete. The patient is not merely describing symptoms over a video call. Where appropriate, the clinician may also review vitals, device readings, digital auscultation, otoscopy images, medication adherence context, diagnostic requests, prior records and care-pathway history.",
        ],
        callout:
          "Ambulant+ defines Contactless Medicine as clinician-led remote care supported by devices, diagnostics, fulfilment and governance-aware intelligence.",
      },
      {
        heading: "Why ordinary telemedicine is not enough",
        body: [
          "Traditional telemedicine solved a major access problem by allowing patients and doctors to speak without travelling. That matters. But video-only telemedicine can still leave important gaps: no live vitals, no structured device context, no auscultation, no otoscopy, no integrated diagnostics, no pharmacy fulfilment, no adherence scoring and no programme-level visibility for funders.",
          "Those gaps are especially important in chronic disease, post-discharge follow-up, elderly care, family care, fertility pathways and medical-aid funded preventive programmes. In these settings, the real question is not simply whether the patient can speak to a doctor. The question is whether the care system can detect risk early, act quickly, maintain continuity and document what happened.",
        ],
        bullets: [
          "Video alone may not show blood pressure, oxygen saturation, glucose, temperature or ECG context.",
          "Patient self-reporting may miss objective signs of deterioration.",
          "A prescription is not the end of care if the patient never receives or takes the medicine correctly.",
          "Funders need visibility into outcomes, adherence, utilisation and risk movement.",
        ],
      },
      {
        heading: "The Ambulant+ Contactless Medicine model",
        body: [
          "Ambulant+ brings the missing layers into one governed ecosystem. The platform connects patients, clinicians, supported devices, MedReach diagnostics, CarePort fulfilment and InsightCore intelligence.",
          "The supported device model focuses on four device categories: Health Monitor, Digital Stethoscope, HD Otoscope and NexRing. Together, these can support remote vitals, digital auscultation, selected visual inspection, longitudinal wellness context, readiness, sleep, activity and temperature-variation signals where configured and appropriate.",
        ],
        bullets: [
          "Health Monitor: blood pressure, SpO₂, temperature, glucose, heart-rate and ECG workflow context.",
          "Digital Stethoscope: heart and lung sound capture for clinician review.",
          "HD Otoscope: selected imaging workflows for ear and visual review.",
          "NexRing: sleep, activity, readiness and temperature-variation context.",
        ],
      },
      {
        heading: "Contactless Medicine is still clinician-led",
        body: [
          "The technology does not replace professional judgement. Device readings, self-checks, dashboards and AI-supported insights must remain part of a clinician-led and governance-aware care pathway.",
          "The point of Contactless Medicine is not to pretend that every physical consultation can be replaced. The point is to make remote care safer, more informative and more operationally complete when remote care is appropriate, while preserving clear escalation to urgent, emergency, specialist or in-person assessment when required.",
        ],
      },
      {
        heading: "Who benefits from Contactless Medicine?",
        body: [
          "Patients benefit from easier access, reduced travel friction, better preparation and continuity. Clinicians benefit from richer context and structured workflows. Medical aids, HMOs and sponsors benefit from preventive-care visibility, adherence signals and claims-ready care events. Pharmacies and laboratories benefit from operational coordination through CarePort and MedReach.",
          "The result is not a simple app. It is an operating layer for remote care, home diagnostics, medication fulfilment and preventive programme visibility.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is Contactless Medicine the same as telemedicine?",
        answer:
          "No. Telemedicine is usually focused on remote communication. Contactless Medicine adds supported clinical device context, home diagnostics, medication fulfilment, care continuity and governance-aware intelligence.",
      },
      {
        question: "Can Contactless Medicine replace emergency care?",
        answer:
          "No. Contactless Medicine is not an emergency service and should not delay urgent, emergency or in-person care when clinically required.",
      },
      {
        question: "Does Ambulant+ make automatic diagnoses?",
        answer:
          "No. Ambulant+ supports clinician-led review. Device data and intelligence layers provide context; they do not replace clinical judgement.",
      },
    ],
    relatedLinks: [
      { label: "Explore Ambulant+ features", href: "/features" },
      { label: "View supported devices", href: "/devices" },
      { label: "Request a demo", href: "/contact?type=demo" },
    ],
  },
  {
    slug: "contactless-medicine-vs-telemedicine",
    title: "Contactless Medicine vs Telemedicine",
    subtitle: "Why healthcare needs more than video calls.",
    description:
      "Telemedicine improves access, but Contactless Medicine adds connected devices, remote monitoring, diagnostics, pharmacy fulfilment, adherence intelligence and governance-aware care workflows.",
    category: "Telemedicine",
    date: "2026-06-01",
    readTime: "9 min read",
    image: "/visuals/features/live-iomt-consultation.webp",
    imageAlt:
      "IoMT-supported virtual consultation showing clinician review with connected medical devices",
    keywords: [
      "Contactless Medicine vs telemedicine",
      "telemedicine South Africa",
      "device-supported telemedicine",
      "virtual care with devices",
      "digital auscultation",
      "remote vitals",
      "remote patient monitoring",
      "home diagnostics",
      "online doctor consultation",
      "doctor booking",
    ],
    sections: [
      {
        heading: "The difference in one sentence",
        body: [
          "Telemedicine connects people remotely. Contactless Medicine connects care remotely.",
          "That distinction matters. A video call can help a patient access a clinician, but healthcare is not only conversation. Good care may require vital signs, clinical history, diagnostic testing, medication access, adherence support, documentation, escalation and follow-up.",
        ],
        callout:
          "Telemedicine is communication-first. Contactless Medicine is care-workflow-first.",
      },
      {
        heading: "What telemedicine usually solves",
        body: [
          "Telemedicine is useful because it reduces distance. A patient can speak with a doctor from home, work, a rural area or another convenient location. For minor conditions, follow-up conversations and simple care navigation, this can be valuable.",
          "But the limitation appears when the consultation needs objective context. A clinician may need to know the blood pressure, oxygen saturation, temperature, glucose level, heart sounds, lung sounds, ear findings, medication history or recent diagnostic results. When those elements are missing, remote care can become over-dependent on patient self-reporting.",
        ],
        bullets: [
          "Telemedicine improves access.",
          "Telemedicine reduces travel and waiting time.",
          "Telemedicine supports simple follow-up and advice.",
          "Telemedicine may become limited when objective clinical data is needed.",
        ],
      },
      {
        heading: "What Contactless Medicine adds",
        body: [
          "Contactless Medicine adds the missing infrastructure around the consultation. Ambulant+ does this by connecting device-supported review, patient profile readiness, home diagnostics, CarePort pharmacy fulfilment, MedReach laboratory coordination, medication reminders, camera verification where enabled and InsightCore programme intelligence.",
          "This makes remote care more useful for primary care, chronic disease, post-discharge follow-up, preventive care, holistic care, fertility pathways, family care, medical-aid programmes and corporate health benefits.",
        ],
        bullets: [
          "Remote vitals and continuous remote monitoring signals.",
          "Digital auscultation through a Digital Stethoscope.",
          "Selected visual review through an HD Otoscope.",
          "Medication adherence scoring and eRx-linked reminders.",
          "Home diagnostics and home phlebotomy through MedReach.",
          "Pharmacy fulfilment and last-mile medicine delivery through CarePort.",
        ],
      },
      {
        heading: "Why device-supported care changes the remote consultation",
        body: [
          "The presence of integrated medical hardware changes the quality of the consultation. A doctor does not have to rely only on what the patient says. Depending on the workflow, the clinician may see vitals, device readings, sound recordings, image captures or longitudinal trend context.",
          "This does not mean every patient can be managed remotely. It means remote care can become more clinically informed when it is appropriate. It also means there can be clearer escalation when the available data suggests the patient needs urgent, emergency or in-person care.",
        ],
      },
      {
        heading: "Why governance matters",
        body: [
          "The more powerful a digital health platform becomes, the more governance matters. Contactless Medicine needs role-based access, consent-aware data sharing, audit trails, clinical disclaimers, professional judgement and careful boundaries around device data.",
          "Ambulant+ is designed to support this kind of governed deployment, especially where medical aids, HMOs, employers, pharmacies, laboratories and clinical networks need accountable workflows rather than isolated app interactions.",
        ],
      },
    ],
    faqs: [
      {
        question: "Is telemedicine still useful?",
        answer:
          "Yes. Telemedicine is useful for access and communication. Contactless Medicine builds on telemedicine by adding devices, diagnostics, fulfilment, adherence and governance layers.",
      },
      {
        question: "Why does remote care need connected devices?",
        answer:
          "Connected devices can provide objective context such as vitals, auscultation, imaging or longitudinal trends, helping clinicians make better-informed decisions when remote care is appropriate.",
      },
      {
        question: "Can Contactless Medicine support primary care?",
        answer:
          "Yes. Contactless Medicine can support primary care workflows where remote review is appropriate, while still escalating patients to in-person or emergency care when needed.",
      },
    ],
    relatedLinks: [
      { label: "Read about Contactless Medicine", href: "/blog/what-is-contactless-medicine" },
      { label: "Explore devices", href: "/devices" },
      { label: "Book a walkthrough", href: "/demos" },
    ],
  },
  {
    slug: "remote-monitoring-for-medical-aids",
    title: "Why Medical Aids Should Invest in Remote Patient Monitoring",
    subtitle:
      "The economics of prevention, adherence and earlier intervention.",
    description:
      "Remote patient monitoring helps medical aids, HMOs and sponsors identify risk earlier, support chronic-care continuity, improve adherence and reduce preventable high-cost complications.",
    category: "Medical Aids",
    date: "2026-06-01",
    readTime: "10 min read",
    image: "/visuals/clients/medical-aid-command-dashboard.webp",
    imageAlt:
      "Medical aid and sponsor dashboard showing remote monitoring, claims, adherence and programme visibility",
    keywords: [
      "remote patient monitoring for medical aids",
      "medical aid remote monitoring",
      "medical aid preventive care",
      "HMO remote monitoring",
      "continuous remote monitoring",
      "continuous vitals",
      "medication adherence scoring",
      "preventive care ROI",
      "medical aid claims reconciliation",
      "medical aid wellness platform",
    ],
    sections: [
      {
        heading: "The economic problem medical aids already understand",
        body: [
          "A member is rarely expensive at the beginning. The cost often arrives after missed appointments, poor monitoring, uncontrolled chronic disease, delayed diagnostics, medication non-adherence and late intervention. By the time complications require hospitalisation, surgery, dialysis escalation, amputation or intensive care, the cost may exceed what can reasonably be recovered from that member.",
          "This is why preventive care matters. Medical aids, HMOs and corporate sponsors do not fund wellness because it sounds attractive. They fund it because healthier members live longer, remain engaged, use benefits more appropriately and avoid catastrophic cost events where possible.",
        ],
        callout:
          "The strongest value of remote monitoring is not cheaper consultation. It is earlier intervention before avoidable deterioration becomes high-cost care.",
      },
      {
        heading: "Why access alone is not enough",
        body: [
          "A medical aid may already cover a consultation, but that does not mean the member attends. Transport, time, pharmacy access, laboratory access, fragmented records and weak follow-up can still break the care journey.",
          "Video-only telemedicine does not always solve this. A member with hypertension, diabetes, respiratory disease, pregnancy-related concerns or post-discharge risk may need more than conversation. They may need remote vitals, continuous monitoring, diagnostic testing, medication fulfilment and adherence visibility.",
        ],
      },
      {
        heading: "What remote patient monitoring changes",
        body: [
          "Remote patient monitoring makes risk more visible between formal care events. Instead of waiting for a member to deteriorate and present late, a programme can monitor signals such as blood pressure, glucose, oxygen saturation, heart-rate trends, sleep, activity, temperature variation, medication adherence and care engagement where the member grants permission.",
          "Ambulant+ supports this through connected devices, patient profiles, Health Passport, medication reminders, CarePort fulfilment, MedReach diagnostics and InsightCore programme visibility.",
        ],
        bullets: [
          "Vitals spot checks and remote vitals workflows.",
          "Continuous remote monitoring through longitudinal signals where configured.",
          "Medication adherence scoring and camera verification where enabled.",
          "Home diagnostics and laboratory result routing.",
          "Pharmacy fulfilment and proof-of-delivery visibility.",
          "Claims preflight, coverage rules and programme reporting.",
        ],
      },
      {
        heading: "Medication adherence is a payer problem",
        body: [
          "Medication non-adherence is not just a patient behaviour issue. It becomes a payer economics issue when chronic disease worsens, complications occur and avoidable admissions follow.",
          "Ambulant+ can support eRx-linked reminders, dose behaviour tracking, camera verification where enabled, adherence scoring, refill continuity and CarePort medicine delivery. This creates a stronger basis for intervention and reward design.",
        ],
      },
      {
        heading: "Why medical aids need programme intelligence",
        body: [
          "Funding benefits without measuring behaviour makes prevention difficult to prove. InsightCore is designed to help programme teams see utilisation, adherence, remote monitoring trends, risk movement, reward eligibility, claims posture and operational performance.",
          "The goal is not to expose unnecessary patient-level detail. The goal is consent-aware, role-based and purpose-specific visibility so that the right teams can act earlier while protecting privacy and governance boundaries.",
        ],
      },
      {
        heading: "The Ambulant+ opportunity for payers",
        body: [
          "For medical aids, HMOs, insurers, employers and sponsors, Ambulant+ can connect consultation funding, remote monitoring, home diagnostics, medicine fulfilment, rewards, claims reconciliation and programme intelligence in one operating layer.",
          "That makes preventive care more measurable, more fundable and more operationally accountable.",
        ],
      },
    ],
    faqs: [
      {
        question: "Why should medical aids fund remote patient monitoring?",
        answer:
          "Remote patient monitoring can help identify risk earlier, support chronic-care continuity, improve adherence and reduce avoidable high-cost complications where earlier intervention is possible.",
      },
      {
        question: "Can Ambulant+ support medication adherence programmes?",
        answer:
          "Yes. Ambulant+ can support eRx-linked reminders, camera verification where enabled, adherence scoring, refill continuity and CarePort medicine fulfilment.",
      },
      {
        question: "Can medical aids see patient data?",
        answer:
          "Visibility should be consent-aware, role-based and purpose-specific. Medical aids may need claims, authorisation and clinical-context visibility, while employers should generally receive aggregated or permissioned programme visibility.",
      },
    ],
    relatedLinks: [
      { label: "Medical aids and sponsors", href: "/clients" },
      { label: "InsightCore intelligence", href: "/insightcore" },
      { label: "Request enterprise demo", href: "/contact?type=partnerships" },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}

export function getRelatedPosts(slug: string): BlogPost[] {
  return blogPosts.filter((post) => post.slug !== slug).slice(0, 2);
}
