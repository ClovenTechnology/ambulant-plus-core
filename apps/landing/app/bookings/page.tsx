import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import WorkflowTimeline from "@/components/WorkflowTimeline";
import ImageStoryBand from "@/components/ImageStoryBand";

export const metadata = {
  title: "Book the right Ambulant+ pathway.",
  description:
    "Ambulant+ booking pathways for consultations, home diagnostics, medicine fulfilment, onboarding and enterprise demos.",
};

export default function Page() {
  return (
    <main>
      <VisualHero
        eyebrow="Bookings"
        title="Route every booking into the right care pathway."
        body="Ambulant+ booking flows are designed to direct patients, clinicians, partners and enterprise teams into the right workspace — consultation, home diagnostics, medicine fulfilment, onboarding or platform demo."
        imageSrc="/visuals/bookings/booking-pathways.webp"
        imageAlt="Ambulant+ digital booking pathways"
        primaryCta={{ label: "Start booking enquiry", href: "/contact?type=booking" }}
        secondaryCta={{ label: "Request demo", href: "/contact?type=demo" }}
        overlayTitle="Booking pathways"
        overlayItems={[
          { label: "Virtual consultation", value: "Patient-to-clinician workflow." },
          { label: "Home diagnostics", value: "MedReach sample-collection pathway." },
          { label: "Medicine fulfilment", value: "CarePort pharmacy and delivery workflow." },
        ]}
      />

      <WorkflowTimeline
        eyebrow="Booking model"
        title="Every request should land in the correct operational lane."
        body="The booking experience should reduce confusion by separating clinical, diagnostic, fulfilment and enterprise actions."
        steps={[
          {
            title: "Choose pathway",
            body:
              "Select consultation, home diagnostics, medicine fulfilment, clinician onboarding, partner onboarding or enterprise demo.",
          },
          {
            title: "Confirm eligibility",
            body:
              "Collect the minimum required context for the selected pathway without unnecessary friction.",
          },
          {
            title: "Route workspace",
            body:
              "Send the request to the correct protected app, operational team or partner workflow.",
          },
          {
            title: "Schedule",
            body:
              "Coordinate timing, availability, location and service requirements for the selected pathway.",
          },
          {
            title: "Prepare",
            body:
              "Surface instructions, readiness steps, consent prompts, payment details or partner requirements.",
          },
          {
            title: "Complete",
            body:
              "Close the workflow with confirmation, documentation, follow-up, fulfilment or escalation where needed.",
          },
        ]}
      />

      <ImageStoryBand
        eyebrow="Patient and partner access"
        title="A booking surface for the whole ecosystem."
        body="Bookings should serve patients seeking care, clinicians joining the platform, partners coordinating services and enterprise teams requesting structured walkthroughs."
        imageSrc="/visuals/bookings/booking-pathways.webp"
        imageAlt="Ambulant+ booking pathways for patients and partners"
        points={[
          "Consultation booking enquiries for supported virtual and contactless-care pathways.",
          "MedReach home diagnostics requests where home collection is appropriate.",
          "CarePort medicine fulfilment and delivery coordination routes.",
          "Clinician onboarding, partner onboarding and enterprise demo pathways.",
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Patient consultation enquiry",
              body:
                "For patients who want to start a supported care request, virtual consultation or device-linked pathway.",
              href: "/contact?type=patient_support",
            },
            {
              title: "Clinician onboarding",
              body:
                "For clinicians who want to join Ambulant+, complete readiness steps and prepare for Contactless Medicine workflows.",
              href: "/contact?type=clinician_onboarding",
            },
            {
              title: "Enterprise demo",
              body:
                "For medical aids, HMOs, employers, sponsors, investors and enterprise teams evaluating Ambulant+.",
              href: "/contact?type=demo",
            },
            {
              title: "MedReach diagnostics",
              body:
                "For laboratories, phlebotomy teams and partners interested in home diagnostics and specimen workflows.",
              href: "/contact?type=medreach_labs",
            },
            {
              title: "CarePort fulfilment",
              body:
                "For pharmacies, riders and fulfilment teams reviewing eRx, dispatch, delivery and proof-of-delivery operations.",
              href: "/contact?type=careport_pharmacies",
            },
            {
              title: "Partnership enquiry",
              body:
                "For organisations that want to explore deployment, integration, distribution, research or commercial collaboration.",
              href: "/contact?type=partnerships",
            },
          ].map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="glass-panel rounded-[30px] p-6 transition hover:-translate-y-1"
            >
              <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
              <div className="mt-6 text-sm font-semibold text-cyan-800">
                Start enquiry →
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}