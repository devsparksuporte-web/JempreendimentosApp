-- ---------------------------------------------------------------------
-- 0032 — Foto de perfil
--
-- A coluna `profiles.avatar_url` existe desde a 0001 e nunca recebeu nada.
-- Enquanto isso, o mapa da equipe desenha bonequinhos gerados pelo Dicebear
-- a partir do nome — o que funciona como espaço reservado, mas não ajuda
-- ninguém a reconhecer quem está em campo.
--
-- Falta só o lugar para guardar o arquivo. O balde é público, como o de
-- fotos de atendimento: uma foto de perfil é vista pelo cliente que recebe
-- o técnico e pela administração no mapa, e assinar URL a cada avatar de
-- uma lista custaria uma chamada por linha.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- ---------------------------------------------------------------------
-- Cada um manda na própria pasta
--
-- O caminho é `<id do perfil>/perfil.jpg`, e a política compara a primeira
-- pasta com o dono da sessão. Sem isso, qualquer pessoa autenticada poderia
-- trocar a foto de qualquer outra — inclusive a do administrador.
-- ---------------------------------------------------------------------
drop policy if exists avatars_leitura on storage.objects;
create policy avatars_leitura on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_envio on storage.objects;
create policy avatars_envio on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_troca on storage.objects;
create policy avatars_troca on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_remocao on storage.objects;
create policy avatars_remocao on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------
select
  (select count(*) from storage.buckets where id = 'avatars')            as balde_deve_ser_1,
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'avatars_%')                                   as politicas_deve_ser_4;
