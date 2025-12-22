import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_CA = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.CA);
export default PRACTICES_CA;
