import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_BW = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.BW);
export default PRACTICES_BW;
