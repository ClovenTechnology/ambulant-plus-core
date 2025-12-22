import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_CD = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.CD);
export default PRACTICES_CD;
