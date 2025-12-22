import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_CU = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.CU);
export default PRACTICES_CU;
