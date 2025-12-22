// apps/patient-app/mock/practices/practices.config.ts
import type { PracticeCountryConfig } from './practices.factory';

export const PRACTICES_CONFIG_BY_COUNTRY: Record<string, PracticeCountryConfig> = {
  ZA: {
    seed: 'ZA-practices-v1',
    countryCode: 'ZA',
    countryName: 'South Africa',
    timezone: 'Africa/Johannesburg',
    nameStyle: 'southern_africa',
    cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Gqeberha', 'Bloemfontein', 'Polokwane'],
    regions: ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'North West'],
    basePriceFromZAR: { team: 480, clinic: 520, hospital: 850 },
  },

  NG: {
    seed: 'NG-practices-v1',
    countryCode: 'NG',
    countryName: 'Nigeria',
    timezone: 'Africa/Lagos',
    nameStyle: 'west_africa',
    cities: ['Lagos', 'Abuja', 'Ibadan', 'Port Harcourt', 'Kano', 'Enugu'],
    regions: ['Lagos', 'FCT', 'Oyo', 'Rivers', 'Kano', 'Enugu'],
    basePriceFromZAR: { team: 420, clinic: 520, hospital: 900 },
  },

  KE: {
    seed: 'KE-practices-v1',
    countryCode: 'KE',
    countryName: 'Kenya',
    timezone: 'Africa/Nairobi',
    nameStyle: 'east_africa',
    cities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'],
    regions: ['Nairobi County', 'Mombasa County', 'Kisumu County', 'Nakuru County', 'Uasin Gishu County'],
    basePriceFromZAR: { team: 400, clinic: 480, hospital: 820 },
  },

  GH: {
    seed: 'GH-practices-v1',
    countryCode: 'GH',
    countryName: 'Ghana',
    timezone: 'Africa/Accra',
    nameStyle: 'west_africa',
    cities: ['Accra', 'Kumasi', 'Takoradi', 'Tamale', 'Cape Coast'],
    regions: ['Greater Accra', 'Ashanti', 'Western', 'Northern', 'Central'],
    basePriceFromZAR: { team: 380, clinic: 450, hospital: 780 },
  },

  BW: {
    seed: 'BW-practices-v1',
    countryCode: 'BW',
    countryName: 'Botswana',
    timezone: 'Africa/Gaborone',
    nameStyle: 'southern_africa',
    cities: ['Gaborone', 'Francistown', 'Maun', 'Kasane', 'Lobatse'],
    regions: ['South-East', 'North-East', 'North-West', 'Chobe', 'Southern'],
    basePriceFromZAR: { team: 460, clinic: 520, hospital: 900 },
  },

  ZW: {
    seed: 'ZW-practices-v1',
    countryCode: 'ZW',
    countryName: 'Zimbabwe',
    timezone: 'Africa/Harare',
    nameStyle: 'southern_africa',
    cities: ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo'],
    regions: ['Harare', 'Bulawayo', 'Manicaland', 'Midlands', 'Masvingo'],
    basePriceFromZAR: { team: 360, clinic: 420, hospital: 760 },
  },

  CD: {
    seed: 'CD-practices-v1',
    countryCode: 'CD',
    countryName: 'DRC',
    timezone: 'Africa/Kinshasa',
    nameStyle: 'central_africa',
    cities: ['Kinshasa', 'Lubumbashi', 'Goma', 'Kisangani', 'Matadi'],
    regions: ['Kinshasa', 'Haut-Katanga', 'North Kivu', 'Tshopo', 'Kongo Central'],
    basePriceFromZAR: { team: 300, clinic: 360, hospital: 650 },
  },

  BR: {
    seed: 'BR-practices-v1',
    countryCode: 'BR',
    countryName: 'Brazil',
    timezone: 'America/Sao_Paulo',
    nameStyle: 'latam',
    cities: ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Brasília', 'Salvador'],
    regions: ['SP', 'RJ', 'MG', 'DF', 'BA'],
    basePriceFromZAR: { team: 620, clinic: 720, hospital: 1200 },
  },

  AR: {
    seed: 'AR-practices-v1',
    countryCode: 'AR',
    countryName: 'Argentina',
    timezone: 'America/Argentina/Buenos_Aires',
    nameStyle: 'latam',
    cities: ['Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata'],
    regions: ['Buenos Aires', 'Córdoba', 'Santa Fe', 'Mendoza', 'Buenos Aires Province'],
    basePriceFromZAR: { team: 580, clinic: 680, hospital: 1100 },
  },

  NZ: {
    seed: 'NZ-practices-v1',
    countryCode: 'NZ',
    countryName: 'New Zealand',
    timezone: 'Pacific/Auckland',
    nameStyle: 'anglosphere',
    cities: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Dunedin'],
    regions: ['Auckland', 'Wellington', 'Canterbury', 'Waikato', 'Otago'],
    basePriceFromZAR: { team: 700, clinic: 820, hospital: 1400 },
  },

  GB: {
    seed: 'GB-practices-v1',
    countryCode: 'GB',
    countryName: 'United Kingdom',
    timezone: 'Europe/London',
    nameStyle: 'europe',
    cities: ['London', 'Manchester', 'Birmingham', 'Bristol', 'Edinburgh', 'Glasgow'],
    regions: ['England', 'England', 'England', 'England', 'Scotland', 'Scotland'],
    basePriceFromZAR: { team: 720, clinic: 850, hospital: 1500 },
  },

  US: {
    seed: 'US-practices-v1',
    countryCode: 'US',
    countryName: 'United States',
    timezone: 'America/New_York',
    nameStyle: 'anglosphere',
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Seattle'],
    regions: ['NY', 'CA', 'IL', 'TX', 'FL', 'WA'],
    basePriceFromZAR: { team: 900, clinic: 1100, hospital: 1900 },
  },

  CA: {
    seed: 'CA-practices-v1',
    countryCode: 'CA',
    countryName: 'Canada',
    timezone: 'America/Toronto',
    nameStyle: 'anglosphere',
    cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa'],
    regions: ['ON', 'BC', 'QC', 'AB', 'ON'],
    basePriceFromZAR: { team: 820, clinic: 980, hospital: 1750 },
  },

  AE: {
    seed: 'AE-practices-v1',
    countryCode: 'AE',
    countryName: 'UAE',
    timezone: 'Asia/Dubai',
    nameStyle: 'middle_east',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Al Ain'],
    regions: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Abu Dhabi'],
    basePriceFromZAR: { team: 950, clinic: 1100, hospital: 2000 },
  },

  SA: {
    seed: 'SA-practices-v1',
    countryCode: 'SA',
    countryName: 'Saudi Arabia',
    timezone: 'Asia/Riyadh',
    nameStyle: 'middle_east',
    cities: ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina'],
    regions: ['Riyadh', 'Makkah', 'Eastern Province', 'Makkah', 'Madinah'],
    basePriceFromZAR: { team: 880, clinic: 1050, hospital: 1900 },
  },

  AU: {
    seed: 'AU-practices-v1',
    countryCode: 'AU',
    countryName: 'Australia',
    timezone: 'Australia/Sydney',
    nameStyle: 'asia_pacific',
    cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'],
    regions: ['NSW', 'VIC', 'QLD', 'WA', 'SA'],
    basePriceFromZAR: { team: 780, clinic: 920, hospital: 1650 },
  },

  CU: {
    seed: 'CU-practices-v1',
    countryCode: 'CU',
    countryName: 'Cuba',
    timezone: 'America/Havana',
    nameStyle: 'latam',
    cities: ['Havana', 'Santiago de Cuba', 'Camagüey', 'Holguín', 'Santa Clara'],
    regions: ['La Habana', 'Santiago de Cuba', 'Camagüey', 'Holguín', 'Villa Clara'],
    basePriceFromZAR: { team: 260, clinic: 320, hospital: 520 },
  },

  SG: {
    seed: 'SG-practices-v1',
    countryCode: 'SG',
    countryName: 'Singapore',
    timezone: 'Asia/Singapore',
    nameStyle: 'asia_pacific',
    cities: ['Singapore'],
    regions: ['Central'],
    basePriceFromZAR: { team: 980, clinic: 1150, hospital: 2200 },
  },

  JM: {
    seed: 'JM-practices-v1',
    countryCode: 'JM',
    countryName: 'Jamaica',
    timezone: 'America/Jamaica',
    nameStyle: 'caribbean',
    cities: ['Kingston', 'Montego Bay', 'Spanish Town', 'Mandeville', 'Ocho Rios'],
    regions: ['Kingston', 'St James', 'St Catherine', 'Manchester', 'St Ann'],
    basePriceFromZAR: { team: 420, clinic: 520, hospital: 980 },
  },

  DM: {
    seed: 'DM-practices-v1',
    countryCode: 'DM',
    countryName: 'Dominica',
    timezone: 'America/Dominica',
    nameStyle: 'caribbean',
    cities: ['Roseau', 'Portsmouth', 'Marigot'],
    regions: ['Saint George', 'Saint John', 'Saint Andrew'],
    basePriceFromZAR: { team: 380, clinic: 460, hospital: 880 },
  },
};
