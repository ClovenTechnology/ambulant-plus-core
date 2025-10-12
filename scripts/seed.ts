// scripts/seed.ts
import { faker } from '@faker-js/faker';
faker.locale = 'en_ZA';
// TODO: import your db client, e.g. import { prisma } from '../packages/db/client';

const labs = ['Ampath', 'Lancet', 'PathCare', 'NHLS', 'Vermaak'];
const pharmacies = ['Clicks', 'Dis-Chem', 'M-Kem', 'Medirite', 'Alpha Pharm'];
const medicalAids = [
  { name: 'Discovery Health', plans: ['Classic Saver', 'Classic Priority', 'KeyCare'] },
  { name: 'Bonitas', plans: ['BonComprehensive', 'BonComplete'] },
  { name: 'Momentum', plans: ['Ingwe', 'Custom', 'Incentive'] },
  { name: 'Medihelp', plans: ['Necesse', 'Prime 2', 'Elite'] },
  { name: 'Fedhealth', plans: ['Maxima Exec', 'MyFed', 'flexiFED 2'] },
];

const specialties = [
  'General Practitioner', 'Cardiologist', 'Endocrinologist',
  'Paediatrician', 'Gynaecologist', 'Psychiatrist'
];

const cities = ['Johannesburg','Cape Town','Durban','Pretoria','Gqeberha','Bloemfontein','Polokwane'];

function zaPhone() { return `0${faker.number.int({min:60,max:87})}${faker.number.int({min:1000000,max:9999999})}`; }
function randPrice(min=250, max=950, step=50){ const r = Math.round((min + Math.random()*(max-min))/step)*step; return r; }

const saFirstNames = ['Thabo','Sipho','Ayanda','Lerato','Nomsa','Khosi','Lwazi','Naledi','Kagiso','Buhle','Sizwe','Iminathi','Thandi','Ntombi','Sanele','Zola','Xolani','Karabo','Lethabo','Palesa','Sibusiso','Tshepo','Andile','Boitumelo','Nonhlanhla','Nandi','Mpho','Gugu','Tebogo','Zanele'];
const saLastNames  = ['Mokoena','Dlamini','Nkosi','Naidoo','Van der Merwe','Botha','Ndlovu','Khoza','Pieterse','Mthembu','Smith','Mabena','Maseko','Mohammed','Jansen','Niemann','Radebe','Mahlangu','Nkuna','Cele','Govender','Pillay','Khumalo','Sithole','Zulu','Meyer','Mokoetsi','Ngwenya','Kekana','De Villiers'];

function fullName() {
  return `${faker.helpers.arrayElement(saFirstNames)} ${faker.helpers.arrayElement(saLastNames)}`;
}

async function main() {
  // 5 Patients
  for (let i=0;i<5;i++){
    const name = fullName();
    const email = faker.internet.email({ firstName: name.split(' ')[0], lastName: name.split(' ')[1] });
    // await prisma.patient.create({ data: { name, email, phone: zaPhone(), tier: i%2? 'Premium':'Free' } });
  }

  // 5 Medical Aids with plans
  for (const ma of medicalAids){
    // await prisma.medicalAid.upsert({...})
  }

  // 5 Labs, 5 Pharmacies
  for (const n of labs){ /* await prisma.lab.create({data:{ name:n, city: faker.helpers.arrayElement(cities)}}) */ }
  for (const n of pharmacies){ /* await prisma.pharmacy.create({data:{ name:n, city: faker.helpers.arrayElement(cities)}}) */ }

  // 5 Freelance Phlebs (MedReach), 5 Riders (CarePort)
  for (let i=0;i<5;i++){
    // await prisma.phlebotomist.create({ data: { name: fullName(), phone: zaPhone(), coverage: faker.helpers.arrayElements(cities, 3).join(', ') }})
    // await prisma.rider.create({ data: { name: fullName(), phone: zaPhone(), vehicle: faker.helpers.arrayElement(['Bike','Car']), coverage: faker.helpers.arrayElements(cities, 3).join(', ') }})
  }

  // 30 Clinicians per specialty
  for (const spec of specialties){
    for (let i=0;i<30;i++){
      const name = fullName();
      // await prisma.clinician.create({
      //   data: {
      //     name, avatarUrl: `https://i.pravatar.cc/150?u=${encodeURIComponent(name)}`,
      //     specialty: spec,
      //     location: faker.helpers.arrayElement(cities),
      //     rating: Number((3.8 + Math.random()*1.2).toFixed(1)),
      //     price: randPrice(),
      //     isOnline: Math.random() > 0.5
      //   }
      // });
    }
  }
  console.log('Seed complete (dry run). Uncomment prisma calls to persist.');
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>process.exit(0));
