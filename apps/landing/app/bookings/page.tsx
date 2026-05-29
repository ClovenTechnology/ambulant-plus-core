import CTA from "@/components/CTA";
import VisualHero from "@/components/VisualHero";
import WorkflowTimeline from "@/components/WorkflowTimeline";
import ImageStoryBand from "@/components/ImageStoryBand";

export const metadata = {
  title: "Book the right Ambulant+ pathway.",
  description: "Ambulant+ booking pathways for consultations, home diagnostics, medicine fulfilment, onboarding and enterprise demos.",
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
        primaryCta={{ label: "Start booking enquiry", href: "/contact" }}
        secondaryCta={{ label: "Request demo", href: "/demos" }}
        overlayTitle="Booking pathways"
        overlayItems={[
          { label: "Virtual consultation", value: "Patient to clinician workflow." },
          { label: "Home diagnostics", value: "MedReach sample collection pathway." },
          { label: "Medicine fulfilment", value: "CarePort pharmacy and delivery workflow." },
        ]}
      />

      <WorkflowTimeline
        eyebrow="Booking model"
        title="Every request should land in the correct operational lane."
        body="The booking experience should reduce confusion by separating clinical, diagnostic, fulfilment and enterprise actions."
        steps={[
          { title: "Choose pathway", body: "Select consultation, home diagnostics, medicine fulfilment, clinician onboarding or enterprise demo." },
          { title: "Confirm eligibility", body: "Collect the minimum required context for the selected pathway without unnecessary friction." },
          { title: "Route workspace", body: "Send the request to the correct protected app or operational team." },
          { title: "Schedule", body: "Coordinate timing, availability, location and service requirements." },
          { title: "Prepare", body: "Surface instructions, readiness steps, consent prompts or partner requirements." },
          { title: "Complete", body: "Close the workflow with confirmation, documentation, follow-up or escalation where needed." },
        ]}
      />

      <ImageStoryBand
        eyebrow="Patient and partner access"
        title="A booking surface for the whole ecosystem."
        body="Bookings should serve patients seeking care, clinicians joining the platform, partners coordinating services and enterprise teams requesting structured walkthroughs."
        imageSrc="/visuals/bookings/booking-pathways.webp"
        imageAlt="Ambulant+ booking pathways for patients and partners"
        points={[
          "Consultation bookings for supported virtual and contactless-care pathways.",
          "MedReach home diagnostics requests where home collection is appropriate.",
          "CarePort medicine fulfilment and delivery coordination routes.",
          "Onboarding and demo pathways for clinicians, partners and clients.",
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 pb-16 md:px-6">
        <CTA />
      </section>
    </main>
  );
}
