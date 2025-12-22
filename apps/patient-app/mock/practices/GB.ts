import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_GB = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.GB);
export default PRACTICES_GB;
