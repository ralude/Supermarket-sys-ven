export const saleShiftPaymentsSql = `
alter table sales add column shift_id text not null default 'legacy-unassigned';
alter table cash_movements add column source_id text;
alter table cash_movements add column source_event_id text;
`;
