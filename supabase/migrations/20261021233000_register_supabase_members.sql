create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration jsonb := coalesce(new.raw_user_meta_data -> 'registration', '{}'::jsonb);
  first_name_value text := trim(coalesce(registration ->> 'first_name', ''));
  last_name_value text := trim(coalesce(registration ->> 'last_name', ''));
  middle_initial_value text := upper(trim(coalesce(registration ->> 'middle_initial', '')));
  phone_value text := trim(coalesce(registration ->> 'phone', ''));
  weight_value text := trim(coalesce(registration ->> 'weight', ''));
  height_value text := trim(coalesce(registration ->> 'height', ''));
  gender_value text := trim(coalesce(registration ->> 'gender', ''));
  payment_method_value text := trim(coalesce(registration ->> 'payment_method', ''));
  birth_date_value date;
  member_age integer;
  created_member_id bigint;
  profile_full_name text := trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
begin
  insert into public.profiles (id, full_name)
  values (new.id, profile_full_name)
  on conflict (id) do nothing;

  if registration = '{}'::jsonb then
    return new;
  end if;

  if first_name_value = '' or length(first_name_value) > 100
      or last_name_value = '' or length(last_name_value) > 100
      or length(middle_initial_value) > 1 then
    raise exception 'Enter a valid first name, last name, and optional middle initial';
  end if;

  if coalesce(new.email, '') = '' or phone_value !~ '^09[0-9]{9}$' then
    raise exception 'Enter a valid email address and Philippine mobile number';
  end if;

  if (case
        when weight_value ~ '^[0-9]+([.][0-9]+)?$'
          then weight_value::numeric between 20 and 500
        else false
      end) is not true
      or (case
        when height_value ~ '^[0-9]+([.][0-9]+)?$'
          then height_value::numeric between 50 and 300
        else false
      end) is not true then
    raise exception 'Enter a valid weight and height';
  end if;

  if gender_value not in ('Male', 'Female') or payment_method_value <> 'Cash' then
    raise exception 'Choose a valid gender and payment method';
  end if;

  begin
    birth_date_value := (registration ->> 'date_of_birth')::date;
  exception when others then
    raise exception 'Enter a valid date of birth';
  end;

  if birth_date_value is null then
    raise exception 'Enter a valid date of birth';
  end if;

  member_age := extract(year from age(current_date, birth_date_value))::integer;
  if member_age < 12 or member_age > 120 then
    raise exception 'Member must be between 12 and 120 years old';
  end if;

  profile_full_name := concat_ws(
    ' ',
    first_name_value,
    nullif(middle_initial_value, ''),
    last_name_value
  );

  insert into public.members (
    full_name,
    first_name,
    last_name,
    middle_initial,
    email,
    phone,
    weight,
    height,
    age,
    date_of_birth,
    gender,
    payment_method,
    status,
    approval_status,
    role
  )
  values (
    profile_full_name,
    first_name_value,
    last_name_value,
    middle_initial_value,
    lower(trim(new.email)),
    phone_value,
    weight_value,
    height_value,
    member_age,
    birth_date_value,
    gender_value,
    payment_method_value,
    'pending',
    'pending',
    'member'
  )
  returning member_id into created_member_id;

  update public.profiles
  set full_name = profile_full_name,
      member_id = created_member_id,
      updated_at = now()
  where id = new.id;

  return new;
end;
$$;

drop policy if exists "Members can read their own membership status" on public.members;

create policy "Members can read their own membership status"
  on public.members for select
  to authenticated
  using (
    member_id = (
      select profiles.member_id
      from public.profiles
      where profiles.id = (select auth.uid())
    )
  );
