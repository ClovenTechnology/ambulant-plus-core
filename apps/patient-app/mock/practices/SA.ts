import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_SA = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.SA);
export default PRACTICES_SA;
