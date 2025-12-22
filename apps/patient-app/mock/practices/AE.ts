import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_AE = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.AE);
export default PRACTICES_AE;
