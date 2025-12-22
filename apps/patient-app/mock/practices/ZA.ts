import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';

export const PRACTICES_ZA = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.ZA);
export default PRACTICES_ZA;
