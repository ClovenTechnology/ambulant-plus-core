import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_NZ = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.NZ);
export default PRACTICES_NZ;
