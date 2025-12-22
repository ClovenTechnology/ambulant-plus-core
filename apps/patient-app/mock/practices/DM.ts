import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_DM = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.DM);
export default PRACTICES_DM;
