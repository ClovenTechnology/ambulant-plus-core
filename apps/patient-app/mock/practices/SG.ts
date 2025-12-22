import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_SG = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.SG);
export default PRACTICES_SG;
