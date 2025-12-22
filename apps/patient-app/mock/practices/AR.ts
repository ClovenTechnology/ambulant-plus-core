import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_AR = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.AR);
export default PRACTICES_AR;
