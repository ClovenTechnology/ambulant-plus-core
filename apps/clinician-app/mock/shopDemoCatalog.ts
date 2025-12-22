//apps/clinician-app/mock/shopDemoCatalog.ts
export type ProductVariant = {
  id: string;
  label: string;
  unitAmountZar: number;
  saleUnitAmountZar?: number;
  imageUrl?: string;
  inStock?: boolean;
  stockQty?: number | null;
  sku?: string;
};

export type Product = {
  id: string;
  name: string;
  description?: string;
  unitAmountZar?: number;
  saleAmountZar?: number;
  imageUrl?: string;
  images?: string[];
  tags?: string[];
  type?: string;
  active?: boolean;

  inStock?: boolean;
  stockQty?: number | null;
  maxQtyPerOrder?: number;
  variants?: ProductVariant[];
};

const PLACEHOLDER = '/shop/_placeholders/product.png';

function sizedVariants(baseId: string, baseSku: string, color: string, price: number, imageUrl?: string): ProductVariant[] {
  const sizes = ['S', 'M', 'L', 'XL', '2XL'] as const;
  return sizes.map((s) => ({
    id: `${baseId}-${color.toLowerCase()}-${s.toLowerCase()}`,
    label: `${color} / ${s}`,
    unitAmountZar: price,
    sku: `${baseSku}-${color.toUpperCase()}-${s}`,
    imageUrl,
    inStock: true,
    stockQty: 25,
  }));
}

export const DEMO_PRODUCTS: Product[] = [
  /* ---------------- CLOTHING ---------------- */
  {
    id: 'merch-shirt-ambulantplus',
    name: 'Ambulant+ Branded Shirt (Premium Cotton)',
    description:
      'Smart, durable branded shirt for team wear and clinic staff. Breathable cotton blend with reinforced seams and embroidery-ready finish. Ideal for daily wear, outreach events, and corporate meetings.',
    type: 'merch',
    active: true,
    tags: ['clothing', 'merch', 'ambulant+'],
    images: [
      '/shop/clothing/shirt-black-front.png',
      '/shop/clothing/shirt-black-back.png',
      '/shop/clothing/shirt-white-front.png',
      '/shop/clothing/shirt-white-back.png',
    ],
    maxQtyPerOrder: 5,
    variants: [
      ...sizedVariants('v-shirt', 'AMB-SHIRT', 'Black', 349, '/shop/clothing/shirt-black-front.png'),
      ...sizedVariants('v-shirt', 'AMB-SHIRT', 'White', 349, '/shop/clothing/shirt-white-front.png'),
    ],
  },
  {
    id: 'merch-tee-ambulantplus',
    name: 'Ambulant+ T-Shirt (Soft Touch)',
    description:
      'Everyday branded tee with a soft-hand feel and modern cut. Perfect for activation campaigns, roadshows, volunteer days, and casual clinic uniform options.',
    type: 'merch',
    active: true,
    tags: ['clothing', 'merch', 'ambulant+'],
    images: ['/shop/clothing/tshirt-black.png', '/shop/clothing/tshirt-white.png'],
    maxQtyPerOrder: 5,
    variants: [
      ...sizedVariants('v-tee', 'AMB-TEE', 'Black', 229, '/shop/clothing/tshirt-black.png'),
      ...sizedVariants('v-tee', 'AMB-TEE', 'White', 229, '/shop/clothing/tshirt-white.png'),
    ],
  },
  {
    id: 'merch-golf-tee',
    name: 'Ambulant+ Golf T (Collared)',
    description:
      'Collared golf tee for a professional but relaxed look. Moisture-wicking fabric helps during long clinic days, demos, and field deployments.',
    type: 'merch',
    active: true,
    tags: ['clothing', 'merch'],
    images: ['/shop/clothing/golft-black.png', '/shop/clothing/golft-white.png'],
    variants: [
      ...sizedVariants('v-golft', 'AMB-GOLF', 'Black', 399, '/shop/clothing/golft-black.png'),
      ...sizedVariants('v-golft', 'AMB-GOLF', 'White', 399, '/shop/clothing/golft-white.png'),
    ],
  },
  {
    id: 'merch-hoodie',
    name: 'Ambulant+ Hoodie (Heavyweight)',
    description:
      'Warm, heavyweight hoodie for tech teams, clinic staff, and supporters. Built for comfort during night shifts, travel, and winter deployments.',
    type: 'merch',
    active: true,
    tags: ['clothing', 'merch'],
    images: ['/shop/clothing/hoodie-black.png', '/shop/clothing/hoodie-grey.png'],
    variants: [
      ...sizedVariants('v-hoodie', 'AMB-HOOD', 'Black', 699, '/shop/clothing/hoodie-black.png'),
      ...sizedVariants('v-hoodie', 'AMB-HOOD', 'Grey', 699, '/shop/clothing/hoodie-grey.png'),
    ],
  },
  {
    id: 'merch-cap',
    name: 'Ambulant+ Golf Cap (One Size)',
    description:
      'Structured cap with breathable panels and adjustable strap. Ideal for outdoor activations and field work.',
    type: 'merch',
    active: true,
    tags: ['clothing', 'merch'],
    imageUrl: '/shop/clothing/cap-black.png',
    variants: [
      {
        id: 'v-cap-black',
        label: 'Black / One Size',
        unitAmountZar: 179,
        sku: 'AMB-CAP-BLK-OS',
        imageUrl: '/shop/clothing/cap-black.png',
        inStock: true,
        stockQty: 50,
      },
    ],
  },
  {
    id: 'merch-scrubs',
    name: 'Clinical Scrubs Set (Top + Pants)',
    description:
      'Comfort-focused scrubs set suitable for clinic and phlebotomy teams. Easy-care fabric, multiple pockets, and clean professional appearance.',
    type: 'merch',
    active: true,
    tags: ['clothing', 'clinic', 'merch'],
    imageUrl: '/shop/clothing/scrubs.png',
    variants: [
      ...sizedVariants('v-scrubs', 'AMB-SCRUB', 'Teal', 799, '/shop/clothing/scrubs.png'),
    ],
  },
  {
    id: 'merch-name-tag',
    name: 'Name Tag (Magnetic Backing)',
    description:
      'Professional name tag with magnetic backing (no pin holes). Great for clinicians, phlebs, partners, and event staff.',
    type: 'merch',
    active: true,
    tags: ['clothing', 'clinic', 'desk'],
    imageUrl: '/shop/clothing/name-tag.png',
    unitAmountZar: 79,
    inStock: true,
    stockQty: 200,
  },
  {
    id: 'merch-card-holder',
    name: 'Card Holder (ID / Access Card)',
    description:
      'Durable ID card holder compatible with standard access cards and staff badges.',
    type: 'merch',
    active: true,
    tags: ['clothing', 'desk'],
    imageUrl: '/shop/clothing/card-holder.png',
    unitAmountZar: 49,
    inStock: true,
    stockQty: 300,
  },
  {
    id: 'merch-lanyard',
    name: 'Ambulant+ Lanyard (Safety Breakaway)',
    description:
      'Branded lanyard with safety breakaway clasp—ideal for clinics, events, and partner deployments.',
    type: 'merch',
    active: true,
    tags: ['clothing', 'desk'],
    imageUrl: '/shop/clothing/lanyard.png',
    unitAmountZar: 59,
    inStock: true,
    stockQty: 300,
  },

  /* ---------------- DESK ---------------- */
  {
    id: 'desk-sleeve',
    name: 'Laptop Sleeve (Padded, 13–15")',
    description:
      'Padded sleeve for laptop protection during travel and site visits. Water-resistant exterior with soft interior lining.',
    type: 'accessory',
    active: true,
    tags: ['desk'],
    imageUrl: '/shop/desk/laptop-sleeve.png',
    unitAmountZar: 249,
    inStock: true,
    stockQty: 80,
  },
  {
    id: 'desk-cooling-fan',
    name: 'Laptop Cooling Fan (USB)',
    description:
      'USB cooling fan pad designed to help stabilize laptop temperatures during long video consults, demos, and analytics workloads.',
    type: 'accessory',
    active: true,
    tags: ['desk', 'tech'],
    imageUrl: '/shop/desk/cooling-fan.png',
    unitAmountZar: 299,
    inStock: true,
    stockQty: 60,
  },
  {
    id: 'desk-monitor-mount',
    name: 'Mounted Screen / Monitor Arm',
    description:
      'Adjustable monitor arm for ergonomic desk setups. Ideal for clinician stations and admin dashboards.',
    type: 'accessory',
    active: true,
    tags: ['desk'],
    imageUrl: '/shop/desk/monitor-arm.png',
    unitAmountZar: 899,
    inStock: true,
    stockQty: 25,
  },
  {
    id: 'desk-triple-extender',
    name: 'Triple Screen Extender (Portable)',
    description:
      'Portable multi-screen extender to improve productivity during consult documentation, triage, and admin ops.',
    type: 'accessory',
    active: true,
    tags: ['desk', 'tech'],
    imageUrl: '/shop/desk/triple-screen.png',
    unitAmountZar: 4999,
    inStock: true,
    stockQty: 8,
  },
  {
    id: 'desk-mug',
    name: 'Ambulant+ Ceramic Mug',
    description:
      'Branded ceramic mug for the office and clinic. Dishwasher-safe and built for daily use.',
    type: 'merch',
    active: true,
    tags: ['desk', 'merch'],
    imageUrl: '/shop/desk/mug.png',
    unitAmountZar: 129,
    inStock: true,
    stockQty: 120,
  },
  {
    id: 'desk-bottle',
    name: 'Branded Water Bottle (BPA-Free)',
    description:
      'BPA-free bottle ideal for long clinic sessions and travel days. Lightweight and durable.',
    type: 'merch',
    active: true,
    tags: ['desk', 'merch'],
    imageUrl: '/shop/desk/water-bottle.png',
    unitAmountZar: 159,
    inStock: true,
    stockQty: 100,
  },
  {
    id: 'desk-thermo',
    name: 'Thermo Flask (Insulated)',
    description:
      'Insulated flask designed to maintain hot/cold temperatures for extended periods—perfect for field deployments.',
    type: 'merch',
    active: true,
    tags: ['desk', 'merch'],
    imageUrl: '/shop/desk/thermo-flask.png',
    unitAmountZar: 299,
    inStock: true,
    stockQty: 60,
  },
  {
    id: 'desk-mousepad',
    name: 'Mouse Pad (Large Desk Mat)',
    description:
      'Large desk mat mouse pad for smoother tracking and a cleaner workstation aesthetic.',
    type: 'accessory',
    active: true,
    tags: ['desk'],
    imageUrl: '/shop/desk/mousepad.png',
    unitAmountZar: 149,
    inStock: true,
    stockQty: 120,
  },

  /* ---------------- TECH ---------------- */
  {
    id: 'tech-laptop-mac',
    name: 'MacBook (Demo Unit)',
    description:
      'Demo laptop entry for presentations and procurement planning. Replace specs/price with the exact model you supply (screen size, RAM, storage, chip generation).',
    type: 'tech',
    active: true,
    tags: ['tech'],
    imageUrl: '/shop/tech/macbook.png',
    unitAmountZar: 32999,
    inStock: true,
    stockQty: 3,
  },
  {
    id: 'tech-laptop-dell',
    name: 'Dell Laptop (Business Class Demo)',
    description:
      'Business-class demo laptop entry for clinician/admin workstations. Replace with your exact Latitude/Precision model details and warranty terms.',
    type: 'tech',
    active: true,
    tags: ['tech'],
    imageUrl: '/shop/tech/dell.png',
    unitAmountZar: 21999,
    inStock: true,
    stockQty: 4,
  },
  {
    id: 'tech-laptop-acer',
    name: 'Acer Laptop (Value Demo)',
    description:
      'Value-oriented demo laptop entry. Replace with your specific Acer model details (CPU/RAM/storage/screen/warranty).',
    type: 'tech',
    active: true,
    tags: ['tech'],
    imageUrl: '/shop/tech/acer.png',
    unitAmountZar: 12999,
    inStock: true,
    stockQty: 6,
  },
  {
    id: 'iot-health-monitor',
    name: 'DueCare Health Monitor (Home + Clinic)',
    description:
      'Multi-parameter health monitoring device used for self-checks at home and during live virtual consultations. Typically supports guided measurement workflows and data sharing into clinical records (where configured). For the demo, paste the exact Linktop spec sheet fields here when you’re ready.',
    type: 'iot',
    active: true,
    tags: ['tech', 'clinic'],
    imageUrl: '/shop/tech/health-monitor.png',
    unitAmountZar: 6999,
    inStock: true,
    stockQty: 10,
  },
  {
    id: 'iot-nexring',
    name: 'NexRing (Smart Ring)',
    description:
      'Wearable smart ring for continuous wellness metrics and trend insights. Designed for lightweight comfort and passive daily tracking. For production: replace with your exact sensors, sampling rates, battery and compatibility specs.',
    type: 'iot',
    active: true,
    tags: ['tech'],
    imageUrl: '/shop/tech/nexring.png',
    unitAmountZar: 2499,
    inStock: true,
    stockQty: 20,
  },
  {
    id: 'iot-stethoscope',
    name: 'Digital Stethoscope (Tele-consult Ready)',
    description:
      'Digital auscultation device designed to capture and share heart/lung sounds during tele-consults (where supported). For production: include frequency response, connectivity, in-box accessories, and clinical usage notes.',
    type: 'iot',
    active: true,
    tags: ['tech', 'clinic'],
    imageUrl: '/shop/tech/digital-stethoscope.png',
    unitAmountZar: 8999,
    inStock: true,
    stockQty: 6,
  },
  {
    id: 'iot-otoscope',
    name: 'HD Otoscope (Imaging)',
    description:
      'HD otoscope for ear exam imaging and documentation (where configured). For production: include resolution, illumination type, tip sizes, and sterilization guidance.',
    type: 'iot',
    active: true,
    tags: ['tech', 'clinic'],
    imageUrl: '/shop/tech/hd-otoscope.png',
    unitAmountZar: 7499,
    inStock: true,
    stockQty: 6,
  },
  {
    id: 'tech-smart-pillow',
    name: 'Smart Pillow',
    description:
      'Smart sleep accessory concept for wellness tracking and comfort. For production: specify sensors, app integration, and cleaning instructions.',
    type: 'tech',
    active: true,
    tags: ['tech'],
    imageUrl: '/shop/tech/smart-pillow.png',
    unitAmountZar: 1499,
    inStock: true,
    stockQty: 15,
  },
  {
    id: 'tech-earbuds',
    name: 'Smart Earbuds',
    description:
      'Smart earbuds for calls and comfort during consult sessions. For production: specify battery life, ANC, codec support, and warranty.',
    type: 'tech',
    active: true,
    tags: ['tech'],
    imageUrl: '/shop/tech/smart-earbuds.png',
    unitAmountZar: 1299,
    inStock: true,
    stockQty: 18,
  },
  {
    id: 'tech-smart-scale',
    name: 'Smart Scale',
    description:
      'Smart scale for home monitoring and trend tracking. For production: specify supported metrics, app integrations, and measurement accuracy ranges.',
    type: 'tech',
    active: true,
    tags: ['tech'],
    imageUrl: '/shop/tech/smart-scale.png',
    unitAmountZar: 899,
    inStock: true,
    stockQty: 22,
  },
  {
    id: 'tech-cgm',
    name: 'Continuous Glucose Monitor (CGM)',
    description:
      'CGM entry for chronic care workflows. For production: include sensor wear duration, calibration needs, reader/app compatibility, and regulatory notes.',
    type: 'tech',
    active: true,
    tags: ['tech', 'clinic'],
    imageUrl: '/shop/tech/cgm.png',
    unitAmountZar: 1999,
    inStock: true,
    stockQty: 12,
  },

  /* ---------------- CLINIC ---------------- */
  {
    id: 'clinic-pod-single-indoor',
    name: 'Consultation Pod (Single – Indoor)',
    description:
      'Single-person consultation pod concept for private audio/video consults. Designed for noise reduction, privacy, and compact footprint. For production: specify dimensions, ventilation, power requirements, and delivery/installation terms.',
    type: 'clinic',
    active: true,
    tags: ['clinic'],
    imageUrl: '/shop/clinic/pod-single-indoor.png',
    unitAmountZar: 249999,
    inStock: true,
    stockQty: 2,
    maxQtyPerOrder: 1,
  },
  {
    id: 'clinic-pod-double-indoor',
    name: 'Consultation Pod (Double – Indoor)',
    description:
      'Two-seat indoor consultation pod for assisted consults (e.g., patient + caregiver). For production: specify dimensions, acoustic rating, ventilation, power, and installation.',
    type: 'clinic',
    active: true,
    tags: ['clinic'],
    imageUrl: '/shop/clinic/pod-double-indoor.png',
    unitAmountZar: 329999,
    inStock: true,
    stockQty: 1,
    maxQtyPerOrder: 1,
  },
  {
    id: 'clinic-pod-single-outdoor',
    name: 'Consultation Pod (Single – Outdoor)',
    description:
      'Outdoor-ready pod concept with weather considerations. For production: include ingress rating, temperature tolerance, anchoring guidance, and service plan.',
    type: 'clinic',
    active: true,
    tags: ['clinic'],
    imageUrl: '/shop/clinic/pod-single-outdoor.png',
    unitAmountZar: 289999,
    inStock: true,
    stockQty: 1,
    maxQtyPerOrder: 1,
  },
  {
    id: 'clinic-solar-kit',
    name: 'Solar Panels for Pods (Kit)',
    description:
      'Solar kit concept to support off-grid/backup power for clinic pods. For production: specify panel wattage, controller/inverter, installation scope, and battery compatibility.',
    type: 'clinic',
    active: true,
    tags: ['clinic'],
    imageUrl: '/shop/clinic/solar-kit.png',
    unitAmountZar: 89999,
    inStock: true,
    stockQty: 3,
    maxQtyPerOrder: 2,
  },
  {
    id: 'clinic-backup-battery',
    name: 'Back-up Battery / Inverter System',
    description:
      'Backup power concept for stable operations during load-shedding. For production: specify capacity (kWh), inverter rating, outlets, and installation terms.',
    type: 'clinic',
    active: true,
    tags: ['clinic'],
    imageUrl: '/shop/clinic/backup-battery.png',
    unitAmountZar: 59999,
    inStock: true,
    stockQty: 4,
    maxQtyPerOrder: 2,
  },
  {
    id: 'clinic-5g-router',
    name: 'Rain 5G Router (With Contract)',
    description:
      'Connectivity package entry for pods/clinics. For production: specify contract length, fair-use policy, router model, coverage disclaimers, and installation notes.',
    type: 'clinic',
    active: true,
    tags: ['clinic', 'tech'],
    imageUrl: '/shop/clinic/rain-5g-router.png',
    unitAmountZar: 1999,
    inStock: true,
    stockQty: 10,
    maxQtyPerOrder: 2,
  },
  {
    id: 'clinic-rx-notepad',
    name: 'Rx Note Pad (50 pages)',
    description:
      'Branded prescription/clinical notes pad for quick handoffs and clinic ops. For production: specify page size, paper type, and reorder bundles.',
    type: 'clinic',
    active: true,
    tags: ['clinic', 'desk'],
    imageUrl: '/shop/clinic/rx-notepad.png',
    unitAmountZar: 79,
    inStock: true,
    stockQty: 200,
  },
];

// Optional: quick normalizer for any demo items missing images
export function withImageFallback(items: Product[]) {
  return items.map((p) => ({
    ...p,
    imageUrl: p.imageUrl || (p.images?.[0] ?? PLACEHOLDER),
    images: p.images?.length ? p.images : [p.imageUrl || PLACEHOLDER],
    tags: (p.tags || []).map((t) => t.toLowerCase()),
    active: p.active ?? true,
  }));
}
