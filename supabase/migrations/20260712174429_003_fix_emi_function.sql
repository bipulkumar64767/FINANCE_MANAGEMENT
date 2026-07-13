/*
# Fix: EMI Schedule Function Variable Naming

## Overview
The generate_emi_schedule function had a variable named `total_payable` which conflicted
with the column name in the UPDATE statement, causing an ambiguous reference error.

## Changes
- Renamed local variable `total_payable` to `v_total_payable` to avoid ambiguity
- Renamed other local variables with `v_` prefix for consistency
*/

CREATE OR REPLACE FUNCTION generate_emi_schedule(app_id uuid)
RETURNS void AS $$
DECLARE
  app_record RECORD;
  v_monthly_rate numeric;
  v_emi_amount numeric;
  v_balance numeric;
  i int;
  v_due_date date;
  v_principal numeric;
  v_interest numeric;
  v_total_payable numeric;
BEGIN
  SELECT * INTO app_record FROM finance_applications WHERE id = app_id;
  IF NOT FOUND THEN RETURN; END IF;

  DELETE FROM emi_schedules WHERE application_id = app_id;

  v_monthly_rate := app_record.interest_rate / 12.0 / 100.0;
  v_balance := app_record.finance_amount;

  IF v_monthly_rate = 0 THEN
    v_emi_amount := app_record.finance_amount / app_record.tenure_months;
  ELSE
    v_emi_amount := app_record.finance_amount * v_monthly_rate * power(1 + v_monthly_rate, app_record.tenure_months) / (power(1 + v_monthly_rate, app_record.tenure_months) - 1);
  END IF;

  v_total_payable := 0;
  v_due_date := (now() + interval '1 month')::date;

  FOR i IN 1..app_record.tenure_months LOOP
    v_interest := v_balance * v_monthly_rate;
    v_principal := v_emi_amount - v_interest;

    IF i = app_record.tenure_months THEN
      v_principal := v_balance;
      v_emi_amount := v_principal + v_interest;
    END IF;

    v_balance := v_balance - v_principal;
    v_total_payable := v_total_payable + v_emi_amount;

    INSERT INTO emi_schedules (application_id, installment_number, due_date, amount, principal, interest, balance)
    VALUES (app_id, i, v_due_date, round(v_emi_amount, 2), round(v_principal, 2), round(v_interest, 2), round(CASE WHEN v_balance < 0 THEN 0 ELSE v_balance END, 2));

    v_due_date := (v_due_date + interval '1 month')::date;
  END LOOP;

  UPDATE finance_applications SET total_payable = round(v_total_payable, 2) WHERE id = app_id;
END;
$$ LANGUAGE plpgsql;
