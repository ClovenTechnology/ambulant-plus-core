import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_NG = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.NG);
export default PRACTICES_NG;
