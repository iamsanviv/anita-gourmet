-- Recomendaciones del asesor de seguridad de Supabase.
alter function public.guard_closed_orders() set search_path = public;
alter function public.recalc_order_total() set search_path = public;
revoke execute on function public.link_staff_from_invite() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;
