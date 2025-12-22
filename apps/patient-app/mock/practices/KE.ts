import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_KE = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.KE);
export default PRACTICES_KE;
