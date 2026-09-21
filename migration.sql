-- Campos adicionais para acompanhar o pagamento Dominipay.
alter table public.orders
  add column if not exists payment_status text not null default 'pending',
  add column if not exists dominipay_payment_id text,
  add column if not exists paid_at timestamptz;

create index if not exists orders_dominipay_payment_id_idx
  on public.orders (dominipay_payment_id);

create index if not exists orders_payment_status_idx
  on public.orders (payment_status);
