/*
# Database Functions: Application Number Generator + EMI Schedule Generator

## Overview
Creates two server-side functions:
1. generate_application_number() - Returns a unique sequential application number (APP-YYYY-NNNNNN)
2. generate_emi_schedule(app_id uuid) - Generates the full EMI schedule for an approved/disbursed application

## Details
- Application numbers use the format APP-YYYY-NNNNNN where NNNNNN is a zero-padded sequence
- EMI schedule uses standard reducing-balance formula: E = P * r * (1+r)^n / ((1+r)^n - 1)
- r = monthly interest rate (annual_rate / 12 / 100)
- Each installment tracks principal, interest, and remaining balance
*/

-- Application number generator
CREATE OR REPLACE FUNCTION generate_application_number()
RETURNS text AS $$
DECLARE
  seq_val bigint;
  year_part text;
  app_number text;
BEGIN
  SELECT nextval('app_number_seq') INTO seq_val;
  year_part := EXTRACT(YEAR FROM now())::text;
  app_number := 'APP-' || year_part || '-' || lpad(seq_val::text, 6, '0');
  RETURN app_number;
END;
$$ LANGUAGE plpgsql;

-- Create the sequence
CREATE SEQUENCE IF NOT EXISTS app_number_seq START 1;

-- EMI schedule generator
CREATE OR REPLACE FUNCTION generate_emi_schedule(app_id uuid)
RETURNS void AS $$
DECLARE
  app_record RECORD;
  monthly_rate numeric;
  emi_amount numeric;
  balance numeric;
  i int;
  due_date_val date;
  principal_component numeric;
  interest_component numeric;
  total_payable numeric;
BEGIN
  SELECT * INTO app_record FROM finance_applications WHERE id = app_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Clear any existing schedule
  DELETE FROM emi_schedules WHERE application_id = app_id;

  monthly_rate := app_record.interest_rate / 12.0 / 100.0;
  balance := app_record.finance_amount;

  -- EMI = P * r * (1+r)^n / ((1+r)^n - 1)
  IF monthly_rate = 0 THEN
    emi_amount := app_record.finance_amount / app_record.tenure_months;
  ELSE
    emi_amount := app_record.finance_amount * monthly_rate * power(1 + monthly_rate, app_record.tenure_months) / (power(1 + monthly_rate, app_record.tenure_months) - 1);
  END IF;

  total_payable := 0;
  due_date_val := (now() + interval '1 month')::date;

  FOR i IN 1..app_record.tenure_months LOOP
    interest_component := balance * monthly_rate;
    principal_component := emi_amount - interest_component;

    -- Last installment: adjust for rounding
    IF i = app_record.tenure_months THEN
      principal_component := balance;
      emi_amount := principal_component + interest_component;
    END IF;

    balance := balance - principal_component;
    total_payable := total_payable + emi_amount;

    INSERT INTO emi_schedules (application_id, installment_number, due_date, amount, principal, interest, balance)
    VALUES (app_id, i, due_date_val, round(emi_amount, 2), round(principal_component, 2), round(interest_component, 2), round(CASE WHEN balance < 0 THEN 0 ELSE balance END, 2));

    due_date_val := (due_date_val + interval '1 month')::date;
  END LOOP;

  -- Update total payable on the application
  UPDATE finance_applications SET total_payable = round(total_payable, 2) WHERE id = app_id;
END;
$$ LANGUAGE plpgsql;
