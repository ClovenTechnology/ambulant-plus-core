-- Ambulant+ Sweep 1A M0-F
-- Current guarded catch-up for ClinicianOnboardingSetting.
-- The historical repair must have established the proven 2026-05-11 base table.
-- Existing later columns are validated; missing later columns are added explicitly.
-- Incompatible existing shape fails closed. No conditional-DDL masking is used.

DO $ambulant$
DECLARE
    v_table_oid oid;
    v_relkind text;
    v_expected record;
    v_actual_type text;
    v_actual_not_null boolean;
    v_actual_default text;
    v_default_norm text;
    v_actual_identity text;
    v_actual_generated text;
    v_pk_count integer;
    v_pk_name text;
    v_pk_columns text[];
    v_index_count integer;
    v_index_unique boolean;
    v_index_primary boolean;
    v_index_valid boolean;
    v_index_ready boolean;
    v_index_method text;
    v_index_predicate text;
    v_index_expression text;
    v_index_nkeys integer;
    v_index_nattrs integer;
    v_index_columns text[];
    v_index_expected record;
    v_later_column record;
BEGIN
    SELECT
        c.oid,
        c.relkind::text
    INTO
        v_table_oid,
        v_relkind
    FROM pg_class AS c
    JOIN pg_namespace AS n
        ON n.oid = c.relnamespace
    WHERE
        n.nspname = 'public'
        AND c.relname = 'ClinicianOnboardingSetting'
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'ClinicianOnboardingSetting is absent at current catch-up; historical base lineage repair did not establish the table';
    END IF;

    IF v_relkind NOT IN ('r', 'p') THEN
        RAISE EXCEPTION
            'ClinicianOnboardingSetting exists but is not a table/partitioned table (relkind=%)',
            v_relkind;
    END IF;

    FOR v_expected IN
        SELECT *
        FROM (
            VALUES
                ('id', 'text', true, 'TEXT_DEFAULT'),
                ('trainingFeeCents', 'integer', true, 'ZERO'),
                ('minimumInitialPaymentCents', 'integer', true, 'ZERO'),
                ('allowPartialPayment', 'boolean', true, 'FALSE'),
                ('balanceRecoveryMode', 'text', true, 'TEXT_MANUAL'),
                ('balanceRecoveryNotes', 'text', false, 'NONE'),
                ('currency', 'character varying(3)', true, 'TEXT_ZAR_VARCHAR'),
                ('paymentProvider', 'text', true, 'TEXT_PAYSTACK'),
                ('cardPaymentEnabled', 'boolean', true, 'TRUE'),
                ('manualPaymentEnabled', 'boolean', true, 'TRUE'),
                ('starterKitItems', 'jsonb', false, 'NONE'),
                ('bankInstructions', 'jsonb', false, 'NONE'),
                ('notes', 'text', false, 'NONE'),
                ('updatedByUserId', 'text', false, 'NONE'),
                ('createdAt', 'timestamp(3) without time zone', true, 'CURRENT_TIMESTAMP'),
                ('updatedAt', 'timestamp(3) without time zone', true, 'NONE')
        ) AS expected(
            column_name,
            expected_type,
            expected_not_null,
            default_kind
        )
    LOOP
        SELECT
            format_type(a.atttypid, a.atttypmod),
            a.attnotnull,
            pg_get_expr(ad.adbin, ad.adrelid),
            a.attidentity::text,
            a.attgenerated::text
        INTO
            v_actual_type,
            v_actual_not_null,
            v_actual_default,
            v_actual_identity,
            v_actual_generated
        FROM pg_attribute AS a
        LEFT JOIN pg_attrdef AS ad
            ON ad.adrelid = a.attrelid
            AND ad.adnum = a.attnum
        WHERE
            a.attrelid = v_table_oid
            AND a.attname = v_expected.column_name
            AND a.attnum > 0
            AND NOT a.attisdropped;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'ClinicianOnboardingSetting missing required base column % before catch-up',
                v_expected.column_name;
        END IF;

        IF v_actual_type <> v_expected.expected_type THEN
            RAISE EXCEPTION
                'ClinicianOnboardingSetting column % type mismatch before catch-up: expected %, actual %',
                v_expected.column_name,
                v_expected.expected_type,
                v_actual_type;
        END IF;

        IF v_actual_not_null IS DISTINCT FROM v_expected.expected_not_null THEN
            RAISE EXCEPTION
                'ClinicianOnboardingSetting column % nullability mismatch before catch-up: expected not_null=%, actual=%',
                v_expected.column_name,
                v_expected.expected_not_null,
                v_actual_not_null;
        END IF;

        IF COALESCE(v_actual_identity, '') <> '' THEN
            RAISE EXCEPTION
                'ClinicianOnboardingSetting column % unexpectedly uses identity before catch-up',
                v_expected.column_name;
        END IF;

        IF COALESCE(v_actual_generated, '') <> '' THEN
            RAISE EXCEPTION
                'ClinicianOnboardingSetting column % unexpectedly uses generated expression before catch-up',
                v_expected.column_name;
        END IF;

        v_default_norm :=
            regexp_replace(
                lower(COALESCE(v_actual_default, '')),
                '\s+',
                '',
                'g'
            );

        CASE v_expected.default_kind
            WHEN 'NONE' THEN
                IF v_actual_default IS NOT NULL THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting column % default mismatch before catch-up: expected none, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'TEXT_DEFAULT' THEN
                IF v_default_norm NOT IN (
                    '''default''::text',
                    '''default'''
                ) THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting column % default mismatch before catch-up: expected default, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'ZERO' THEN
                IF v_default_norm NOT IN ('0', '0::integer') THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting column % default mismatch before catch-up: expected 0, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'FALSE' THEN
                IF v_default_norm NOT IN ('false', 'false::boolean') THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting column % default mismatch before catch-up: expected false, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'TRUE' THEN
                IF v_default_norm NOT IN ('true', 'true::boolean') THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting column % default mismatch before catch-up: expected true, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'TEXT_MANUAL' THEN
                IF v_default_norm NOT IN (
                    '''manual''::text',
                    '''manual'''
                ) THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting column % default mismatch before catch-up: expected manual, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'TEXT_ZAR_VARCHAR' THEN
                IF v_default_norm NOT IN (
                    '''zar''::charactervarying',
                    '''zar''::charactervarying(3)',
                    '''zar''::varchar',
                    '''zar''::varchar(3)',
                    '''zar'''
                ) THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting column % default mismatch before catch-up: expected ZAR, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'TEXT_PAYSTACK' THEN
                IF v_default_norm NOT IN (
                    '''paystack''::text',
                    '''paystack'''
                ) THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting column % default mismatch before catch-up: expected paystack, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'CURRENT_TIMESTAMP' THEN
                IF v_default_norm NOT IN ('current_timestamp', 'now()') THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting column % default mismatch before catch-up: expected CURRENT_TIMESTAMP/now(), actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            ELSE
                RAISE EXCEPTION
                    'Internal migration validation error: unknown default kind %',
                    v_expected.default_kind;
        END CASE;
    END LOOP;

    SELECT count(*)
    INTO v_pk_count
    FROM pg_constraint AS con
    WHERE
        con.conrelid = v_table_oid
        AND con.contype = 'p';

    IF v_pk_count <> 1 THEN
        RAISE EXCEPTION
            'ClinicianOnboardingSetting primary-key count mismatch before catch-up: expected 1, actual %',
            v_pk_count;
    END IF;

    SELECT
        con.conname,
        ARRAY(
            SELECT a.attname
            FROM unnest(con.conkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute AS a
                ON a.attrelid = con.conrelid
                AND a.attnum = k.attnum
            ORDER BY k.ord
        )
    INTO
        v_pk_name,
        v_pk_columns
    FROM pg_constraint AS con
    WHERE
        con.conrelid = v_table_oid
        AND con.contype = 'p'
    LIMIT 1;

    IF v_pk_name <> 'ClinicianOnboardingSetting_pkey' THEN
        RAISE EXCEPTION
            'ClinicianOnboardingSetting primary-key name mismatch before catch-up: expected ClinicianOnboardingSetting_pkey, actual %',
            v_pk_name;
    END IF;

    IF v_pk_columns IS DISTINCT FROM ARRAY['id']::text[] THEN
        RAISE EXCEPTION
            'ClinicianOnboardingSetting primary-key columns mismatch before catch-up: expected {id}, actual %',
            v_pk_columns;
    END IF;

    FOR v_index_expected IN
        SELECT *
        FROM (
            VALUES
                ('ClinicianOnboardingSetting_paymentProvider_idx', 'paymentProvider'),
                ('ClinicianOnboardingSetting_cardPaymentEnabled_idx', 'cardPaymentEnabled'),
                ('ClinicianOnboardingSetting_manualPaymentEnabled_idx', 'manualPaymentEnabled')
        ) AS expected(index_name, column_name)
    LOOP
        SELECT count(*)
        INTO v_index_count
        FROM pg_class AS idx
        JOIN pg_namespace AS n
            ON n.oid = idx.relnamespace
        JOIN pg_index AS i
            ON i.indexrelid = idx.oid
        WHERE
            n.nspname = 'public'
            AND idx.relname = v_index_expected.index_name
            AND i.indrelid = v_table_oid;

        IF v_index_count <> 1 THEN
            RAISE EXCEPTION
                'ClinicianOnboardingSetting canonical index % count mismatch before catch-up: expected 1, actual %',
                v_index_expected.index_name,
                v_index_count;
        END IF;

        SELECT
            i.indisunique,
            i.indisprimary,
            i.indisvalid,
            i.indisready,
            am.amname,
            pg_get_expr(i.indpred, i.indrelid),
            pg_get_expr(i.indexprs, i.indrelid),
            i.indnkeyatts,
            i.indnatts,
            ARRAY(
                SELECT a.attname
                FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
                JOIN pg_attribute AS a
                    ON a.attrelid = i.indrelid
                    AND a.attnum = k.attnum
                WHERE k.ord <= i.indnkeyatts
                ORDER BY k.ord
            )
        INTO
            v_index_unique,
            v_index_primary,
            v_index_valid,
            v_index_ready,
            v_index_method,
            v_index_predicate,
            v_index_expression,
            v_index_nkeys,
            v_index_nattrs,
            v_index_columns
        FROM pg_class AS idx
        JOIN pg_namespace AS n
            ON n.oid = idx.relnamespace
        JOIN pg_index AS i
            ON i.indexrelid = idx.oid
        JOIN pg_am AS am
            ON am.oid = idx.relam
        WHERE
            n.nspname = 'public'
            AND idx.relname = v_index_expected.index_name
            AND i.indrelid = v_table_oid
        LIMIT 1;

        IF
            v_index_unique
            OR v_index_primary
            OR NOT v_index_valid
            OR NOT v_index_ready
            OR v_index_method <> 'btree'
            OR v_index_predicate IS NOT NULL
            OR v_index_expression IS NOT NULL
            OR v_index_nkeys <> 1
            OR v_index_nattrs <> 1
            OR v_index_columns IS DISTINCT FROM ARRAY[v_index_expected.column_name]::text[]
        THEN
            RAISE EXCEPTION
                'ClinicianOnboardingSetting canonical index % has incompatible shape before catch-up',
                v_index_expected.index_name;
        END IF;
    END LOOP;

    FOR v_later_column IN
        SELECT *
        FROM (
            VALUES
                ('commercialPathways'),
                ('starterKitDepositItems'),
                ('trainingPolicy')
        ) AS later(column_name)
    LOOP
        PERFORM 1
        FROM pg_attribute AS a
        WHERE
            a.attrelid = v_table_oid
            AND a.attname = v_later_column.column_name
            AND a.attnum > 0
            AND NOT a.attisdropped;

        IF NOT FOUND THEN
            EXECUTE format(
                'ALTER TABLE public.%I ADD COLUMN %I JSONB',
                'ClinicianOnboardingSetting',
                v_later_column.column_name
            );
        END IF;
    END LOOP;

    FOR v_expected IN
        SELECT *
        FROM (
            VALUES
                ('id', 'text', true, 'TEXT_DEFAULT'),
                ('trainingFeeCents', 'integer', true, 'ZERO'),
                ('minimumInitialPaymentCents', 'integer', true, 'ZERO'),
                ('allowPartialPayment', 'boolean', true, 'FALSE'),
                ('balanceRecoveryMode', 'text', true, 'TEXT_MANUAL'),
                ('balanceRecoveryNotes', 'text', false, 'NONE'),
                ('currency', 'character varying(3)', true, 'TEXT_ZAR_VARCHAR'),
                ('paymentProvider', 'text', true, 'TEXT_PAYSTACK'),
                ('cardPaymentEnabled', 'boolean', true, 'TRUE'),
                ('manualPaymentEnabled', 'boolean', true, 'TRUE'),
                ('starterKitItems', 'jsonb', false, 'NONE'),
                ('starterKitDepositItems', 'jsonb', false, 'NONE'),
                ('bankInstructions', 'jsonb', false, 'NONE'),
                ('commercialPathways', 'jsonb', false, 'NONE'),
                ('trainingPolicy', 'jsonb', false, 'NONE'),
                ('notes', 'text', false, 'NONE'),
                ('updatedByUserId', 'text', false, 'NONE'),
                ('createdAt', 'timestamp(3) without time zone', true, 'CURRENT_TIMESTAMP'),
                ('updatedAt', 'timestamp(3) without time zone', true, 'NONE')
        ) AS expected(
            column_name,
            expected_type,
            expected_not_null,
            default_kind
        )
    LOOP
        SELECT
            format_type(a.atttypid, a.atttypmod),
            a.attnotnull,
            pg_get_expr(ad.adbin, ad.adrelid),
            a.attidentity::text,
            a.attgenerated::text
        INTO
            v_actual_type,
            v_actual_not_null,
            v_actual_default,
            v_actual_identity,
            v_actual_generated
        FROM pg_attribute AS a
        LEFT JOIN pg_attrdef AS ad
            ON ad.adrelid = a.attrelid
            AND ad.adnum = a.attnum
        WHERE
            a.attrelid = v_table_oid
            AND a.attname = v_expected.column_name
            AND a.attnum > 0
            AND NOT a.attisdropped;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'ClinicianOnboardingSetting missing required current column % after catch-up',
                v_expected.column_name;
        END IF;

        IF v_actual_type <> v_expected.expected_type THEN
            RAISE EXCEPTION
                'ClinicianOnboardingSetting current column % type mismatch: expected %, actual %',
                v_expected.column_name,
                v_expected.expected_type,
                v_actual_type;
        END IF;

        IF v_actual_not_null IS DISTINCT FROM v_expected.expected_not_null THEN
            RAISE EXCEPTION
                'ClinicianOnboardingSetting current column % nullability mismatch: expected not_null=%, actual=%',
                v_expected.column_name,
                v_expected.expected_not_null,
                v_actual_not_null;
        END IF;

        IF COALESCE(v_actual_identity, '') <> '' THEN
            RAISE EXCEPTION
                'ClinicianOnboardingSetting current column % unexpectedly uses identity',
                v_expected.column_name;
        END IF;

        IF COALESCE(v_actual_generated, '') <> '' THEN
            RAISE EXCEPTION
                'ClinicianOnboardingSetting current column % unexpectedly uses generated expression',
                v_expected.column_name;
        END IF;

        v_default_norm :=
            regexp_replace(
                lower(COALESCE(v_actual_default, '')),
                '\s+',
                '',
                'g'
            );

        CASE v_expected.default_kind
            WHEN 'NONE' THEN
                IF v_actual_default IS NOT NULL THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting current column % default mismatch: expected none, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'TEXT_DEFAULT' THEN
                IF v_default_norm NOT IN (
                    '''default''::text',
                    '''default'''
                ) THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting current column % default mismatch: expected default, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'ZERO' THEN
                IF v_default_norm NOT IN ('0', '0::integer') THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting current column % default mismatch: expected 0, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'FALSE' THEN
                IF v_default_norm NOT IN ('false', 'false::boolean') THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting current column % default mismatch: expected false, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'TRUE' THEN
                IF v_default_norm NOT IN ('true', 'true::boolean') THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting current column % default mismatch: expected true, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'TEXT_MANUAL' THEN
                IF v_default_norm NOT IN (
                    '''manual''::text',
                    '''manual'''
                ) THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting current column % default mismatch: expected manual, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'TEXT_ZAR_VARCHAR' THEN
                IF v_default_norm NOT IN (
                    '''zar''::charactervarying',
                    '''zar''::charactervarying(3)',
                    '''zar''::varchar',
                    '''zar''::varchar(3)',
                    '''zar'''
                ) THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting current column % default mismatch: expected ZAR, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'TEXT_PAYSTACK' THEN
                IF v_default_norm NOT IN (
                    '''paystack''::text',
                    '''paystack'''
                ) THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting current column % default mismatch: expected paystack, actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            WHEN 'CURRENT_TIMESTAMP' THEN
                IF v_default_norm NOT IN ('current_timestamp', 'now()') THEN
                    RAISE EXCEPTION
                        'ClinicianOnboardingSetting current column % default mismatch: expected CURRENT_TIMESTAMP/now(), actual %',
                        v_expected.column_name,
                        v_actual_default;
                END IF;

            ELSE
                RAISE EXCEPTION
                    'Internal migration validation error: unknown default kind %',
                    v_expected.default_kind;
        END CASE;
    END LOOP;
END
$ambulant$;
