-- Supabase's automatic-RLS event trigger does not need to be a public RPC.
-- Change only caller privileges; retain the function, owner, and event trigger.
do $migration$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable()
      from public, anon, authenticated;
  end if;
end;
$migration$;
