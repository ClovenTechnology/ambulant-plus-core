import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_GH = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.GH);
export default PRACTICES_GH;
