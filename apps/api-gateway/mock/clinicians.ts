// apps/api-gateway/mock/clinicians.ts
export type ClinicianClass = 'Doctor' | 'Allied Health' | 'Wellness';

export type Clinician = {
  id: string;
  cls: ClinicianClass;
  name: string;
  specialty: string;
  location: string;
  rating: number;   // 0..5
  priceZAR: number; // per consult
  online: boolean;
};

const cities = [
  'Johannesburg','Cape Town','Durban','Pretoria','Gqeberha','Bloemfontein',
  'Polokwane','Mbombela','Kimberley','Rustenburg','East London','Pietermaritzburg'
];

function pick<T>(arr: T[], i: number) { return arr[i % arr.length]; }
function price(base: number, i: number) { return Math.round((base + (i % 7) * 50) / 10) * 10; }
function rating(i: number) { return 3.9 + ((i * 73) % 12) / 10; }
function online(i: number) { return (i % 3) !== 0; }

const doctors = [
  'Thabo Mokoena','Ayanda Dlamini','Sibusiso Nkosi','Nomsa Khumalo','Zanele Ndlovu',
  'Kabelo Molefe','Lerato Mthembu','Sipho Zondo','Nokuthula Mabuza','Themba Nkomo',
  'Lindiwe Gama','Bongani Sithole','Nandi Maseko','Sanele Gumede','Tshepo Ramaphosa',
  'Gugu Mdletshe','Khanyi Cele','Mpho Baloyi','Lwazi Dlamini','Boitumelo Radebe',
  'Siyabonga Zulu','Andile Mabaso','Nonhle Mhlongo','Thuli Hlophe','Vusi Nkabinde',
  'Naledi Mokoena','Karabo Phiri','Onke Mbatha','Zinzi Ncube','Kea Sebe'
];
const docSpecialties = [
  'Family Medicine','Internal Medicine','Cardiology','Endocrinology','Dermatology',
  'Neurology','Paediatrics','Obstetrics & Gynaecology','Psychiatry','Orthopaedics'
];

const allied = [
  'Siphesihle Mthethwa','Kea Moagi','Retha Potgieter','Palesa Mohlala','Koketso Molewa',
  'Ayabonga Kani','Lebogang Mashaba','Reabetswe Tlhape','Aphiwe Jacobs','Kgaogelo Selokela',
  'Refiloe Tshabalala','Banele Majola','Sihle Nxumalo','Siyanda Buthelezi','Promise Madi',
  'Tsakane Mabunda','Leruo Maluleke','Tsepo Netsianda','Khosi Mkhize','Mpumi Ngwenya',
  'Teboho Motaung','Katlego Mogale','Mmabatho Motsamai','Zandile Zikalala','Lebo Seabela',
  'Tumelo Seabi','Sinethemba Ncapai','Mmathapelo Moeng','Gugulethu Linda','Thandeka Msimango'
];
const alliedSpecs = ['Physiotherapy','Pharmacist','Nursing','Occupational Therapy','Dietetics','Speech Therapy'];

const wellness = [
  'Nomfundo Dladla','Phindile Hadebe','Xolani Zwane','Amogelang Gumbi','Noluthando Majozi',
  'Nqobile Mpanza','Sbahle Khanyile','Sindi Dube','Andiswa Mlambo','Zimasa Tshazi',
  'Sipho Maseko','Khaya Dikana','Thanduxolo Mbatha','Nqobile Nene','Sibusisiwe Sokhela',
  'Zanele Msimang','Hlengiwe Hlatshwayo','Thabo Mohlala','Naledi Dikana','Andile Ndaba',
  'Kgatlego Mokgadi','Refentse Monareng','Bongiwe Makhubu','Sindiswa Myeni','Sanele Bhengu',
  'Siphokazi Manci','Ayanda Sibiya','Sithembiso Majozi','Snenhlanhla Ngcobo','Yanga Bongo'
];
const wellSpecs = ['Nutrition Coach','Fitness Coach','Mental Wellness','Lifestyle Medicine'];

function buildGroup(names: string[], cls: ClinicianClass, specs: string[], basePrice: number): Clinician[] {
  return names.map((name, i) => ({
    id: `${cls.toLowerCase().replace(/\s/g,'')}-${i+1}`,
    cls,
    name,
    specialty: pick(specs, i),
    location: pick(cities, i*7 + 3),
    rating: Math.min(5, Math.max(3.5, parseFloat(rating(i).toFixed(1)))),
    priceZAR: price(basePrice, i),
    online: online(i),
  }));
}

export const CLINICIANS: Clinician[] = [
  ...buildGroup(doctors, 'Doctor', docSpecialties, 650),
  ...buildGroup(allied, 'Allied Health', alliedSpecs, 450),
  ...buildGroup(wellness, 'Wellness', wellSpecs, 350),
];
