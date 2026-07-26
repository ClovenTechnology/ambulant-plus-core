import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

export type AdminPasswordValidation =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export function validateAdminPassword(
  password: string,
): AdminPasswordValidation {
  if (password.length < 12) {
    return {
      ok: false,
      error: 'password_minimum_12_characters',
    };
  }

  if (password.length > 128) {
    return {
      ok: false,
      error: 'password_maximum_128_characters',
    };
  }

  if (/\s/.test(password)) {
    return {
      ok: false,
      error: 'password_must_not_contain_spaces',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      ok: false,
      error: 'password_requires_lowercase',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      ok: false,
      error: 'password_requires_uppercase',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      ok: false,
      error: 'password_requires_number',
    };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      ok: false,
      error: 'password_requires_symbol',
    };
  }

  return {
    ok: true,
  };
}

export function hashAdminPassword(
  password: string,
) {
  const validation =
    validateAdminPassword(password);

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const salt =
    randomBytes(16).toString('hex');

  const hash =
    scryptSync(
      password,
      salt,
      KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: MAX_MEMORY,
      },
    ).toString('hex');

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt,
    hash,
  ].join('$');
}

export function verifyAdminPassword(
  password: string,
  storedHash: string,
) {
  try {
    const parts =
      String(storedHash || '').split('$');

    if (
      parts.length !== 6 ||
      parts[0] !== 'scrypt'
    ) {
      return false;
    }

    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = parts[4];
    const encodedExpected = parts[5];

    if (
      n !== SCRYPT_N ||
      r !== SCRYPT_R ||
      p !== SCRYPT_P ||
      !/^[a-f0-9]{32}$/i.test(salt) ||
      !/^[a-f0-9]{128}$/i.test(
        encodedExpected,
      )
    ) {
      return false;
    }

    const expected =
      Buffer.from(
        encodedExpected,
        'hex',
      );

    const actual =
      scryptSync(
        password,
        salt,
        expected.length,
        {
          N: n,
          r,
          p,
          maxmem: MAX_MEMORY,
        },
      );

    return (
      actual.length === expected.length &&
      timingSafeEqual(
        actual,
        expected,
      )
    );
  }
  catch {
    return false;
  }
}