import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_AU = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.AU);
export default PRACTICES_AU;
