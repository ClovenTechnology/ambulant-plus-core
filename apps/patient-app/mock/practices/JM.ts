import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_JM = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.JM);
export default PRACTICES_JM;
