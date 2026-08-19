export type UserFacingError = {
  message: string;
  referenceId: string;
  retryable: boolean;
  code: string;
};

const MESSAGES: Record<string, string> = {
  admin_authentication_required: 'Your Admin session has expired. Sign in again and retry.',
  secure_admin_credential_required: 'This action requires a password-authenticated Staff session. Sign in with your Staff password and retry.',
  admin_credential_setup_required: 'Password sign-in has not been provisioned for this Staff account. Ask a SUPER_ADMIN or authorised credential administrator to provision access.',
  admin_credential_already_exists: 'Password sign-in is already configured for this Staff account.',
  current_password_invalid: 'The current password is incorrect.',
  admin_password_change_failed: 'Your password could not be changed.',
  staff_credential_provision_failed: 'Password sign-in could not be provisioned for this Staff account.',
  self_credential_provision_forbidden: 'You cannot provision a new credential for your own account from Staff administration. Use My Profile to change your password.',
  staff_account_unavailable: 'Password sign-in cannot be provisioned while this Staff account is suspended or archived.',
  staff_capability_required: 'Your Staff role does not permit this action.',
  staff_employment_access_denied: 'You do not have permission to view this employment information.',
  staff_employment_manage_required: 'You do not have permission to change core employment details.',
  staff_compensation_manage_required: 'You do not have permission to change Staff compensation.',
  staff_payroll_manage_required: 'You do not have permission to change payroll administration fields.',
  staff_employment_change_manage_required: 'You do not have permission to record Staff employment changes.',
  unsupported_staff_employment_fields: 'One or more submitted employment fields are not supported for this operation.',
  staff_employment_changes_required: 'No authorised employment fields were supplied.',
  position_title_managed_by_designation: 'Position title is governed by the Staff designation. Change the designation instead of entering a free-text position title.',
  future_dated_employment_change_requires_assignment_engine: 'Future-effective position or salary changes are not applied by the current-primary workflow. Use an effective date of today or earlier until the effective-dated assignment engine is enabled.',
  department_not_available: 'Choose an active Department.',
  designation_required_for_department_change: 'Choose or clear a Designation when changing Department.',
  designation_not_found: 'The selected Designation could not be found.',
  designation_department_mismatch: 'The selected Designation does not belong to the selected Department.',
  manager_not_available: 'Choose an active Staff member as Manager.',
  manager_cycle_forbidden: 'This Manager selection would create a circular reporting line.',
  self_manager_forbidden: 'A Staff member cannot be their own Manager.',
  staff_bank_manage_required: 'You do not have permission to change these payout details.',
  staff_bank_required_fields_missing: 'Enter the account holder, account number and bank code.',
  staff_bank_account_number_invalid: 'Check the bank account number and try again.',
  staff_bank_encryption_not_configured: 'Secure Staff banking storage is not configured. Ask a platform administrator to configure it before saving payout details.',
  staff_document_manage_required: 'You do not have permission to issue Staff employment documents.',
  staff_document_access_denied: 'You do not have permission to view this Staff document.',
  staff_leave_manage_required: 'You do not have permission to change Staff leave balances.',
  staff_document_type_invalid: 'Upload a PDF, JPEG or PNG document.',
  staff_document_size_invalid: 'Employment documents must be 15 MB or smaller.',
  staff_activity_access_denied: 'You do not have permission to view this Staff activity report.',
  enterprise_media_storage_not_configured: 'Image storage is not configured for this production environment. Ask a platform administrator to configure the managed media bucket and region.',
  enterprise_media_image_type_invalid: 'Choose a JPEG, PNG or WebP image.',
  enterprise_media_image_size_invalid: 'Image files must be 8 MB or smaller.',
  direct_call_target_busy: 'This Staff member is already on another call.',
  direct_call_target_unavailable: 'This Staff member is not currently available for a call.',
  direct_call_no_longer_ringing: 'This call is no longer ringing. Start a new call if you still need to connect.',
  staff_activity_session_required: 'Your Staff session could not be identified. Sign in again.',
};

function makeReference() {
  try {
    return `ADM-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  } catch {
    return `ADM-${Date.now().toString(36).toUpperCase()}`;
  }
}

export function userFacingApiError(input: {
  response?: Response | null;
  json?: any;
  fallback: string;
}): UserFacingError {
  const code = String(input.json?.error || '').trim();
  const suppliedMessage = String(input.json?.message || '').trim();
  const referenceId = String(
    input.json?.referenceId || input.response?.headers.get('x-request-id') || makeReference(),
  ).trim();
  const status = input.response?.status || 0;
  const retryable = status === 0 || status === 408 || status === 425 || status === 429 || status >= 500;
  const message = MESSAGES[code] || suppliedMessage || (code && !code.includes('_') ? code : input.fallback);
  return { message, referenceId, retryable, code: code || 'unknown_error' };
}

export function errorText(error: UserFacingError | null) {
  if (!error) return '';
  return `${error.message} Reference: ${error.referenceId}`;
}
