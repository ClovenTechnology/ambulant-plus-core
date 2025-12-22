import { buildPracticesForCountry } from './practices.factory';
import { PRACTICES_CONFIG_BY_COUNTRY } from './practices.config';
export const PRACTICES_BR = buildPracticesForCountry(PRACTICES_CONFIG_BY_COUNTRY.BR);
export default PRACTICES_BR;
