import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_US = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.US);
export default PRACTICES_US;
