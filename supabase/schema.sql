/* =========================================================
   ResQ-Route
   SUPABASE DATABASE - FINAL UPGRADE
   Smart City Emergency Orchestration Network

   RUN:
   Supabase Dashboard
   → SQL Editor
   → New Query
   → Paste
   → Run

   IMPORTANT:
   This version is designed to run AFTER the original
   ResQ-Route schema.
   It preserves the existing database structure and
   adds the missing production/prototype functionality.
   ========================================================= */


/* =========================================================
   1. EXTENSIONS
   ========================================================= */

create extension if not exists "pgcrypto";


/* =========================================================
   2. EXISTING ENUMS
   ========================================================= */

do $$
begin

    if not exists (
        select 1
        from pg_type
        where typname = 'user_role'
    ) then

        create type public.user_role as enum (
            'family',
            'driver',
            'hospital'
        );

    end if;


    if not exists (
        select 1
        from pg_type
        where typname = 'ambulance_status'
    ) then

        create type public.ambulance_status as enum (
            'available',
            'assigned',
            'en_route',
            'at_scene',
            'transporting',
            'at_hospital',
            'offline',
            'maintenance'
        );

    end if;


    if not exists (
        select 1
        from pg_type
        where typname = 'emergency_priority'
    ) then

        create type public.emergency_priority as enum (
            'low',
            'medium',
            'high',
            'critical'
        );

    end if;


    if not exists (
        select 1
        from pg_type
        where typname = 'emergency_status'
    ) then

        create type public.emergency_status as enum (
            'REPORTED',
            'DISPATCHING',
            'ASSIGNED',
            'DRIVER_ACCEPTED',
            'EN_ROUTE_TO_PATIENT',
            'ARRIVED_AT_PATIENT',
            'PATIENT_ONBOARD',
            'EN_ROUTE_TO_HOSPITAL',
            'ARRIVED_AT_HOSPITAL',
            'COMPLETED',
            'CANCELLED'
        );

    end if;

end
$$;


/* =========================================================
   3. EXISTING TABLE SAFETY
   ========================================================= */

create table if not exists public.profiles (

    id uuid primary key
        references auth.users(id)
        on delete cascade,

    name text not null,

    email text not null,

    phone text,

    role public.user_role
        not null default 'family',

    created_at timestamptz
        not null default now(),

    updated_at timestamptz
        not null default now()
);


create table if not exists public.patients (

    id uuid primary key
        default gen_random_uuid(),

    user_id uuid
        references public.profiles(id)
        on delete cascade,

    name text not null,

    age integer,

    gender text,

    blood_group text,

    allergies text,

    medical_conditions text,

    consent_given boolean
        not null default false,

    consent_timestamp timestamptz,

    created_at timestamptz
        not null default now(),

    updated_at timestamptz
        not null default now()
);


create table if not exists public.emergency_contacts (

    id uuid primary key
        default gen_random_uuid(),

    patient_id uuid not null
        references public.patients(id)
        on delete cascade,

    name text not null,

    relationship text,

    phone text not null,

    email text,

    created_at timestamptz
        not null default now()
);


create table if not exists public.ambulances (

    id uuid primary key
        default gen_random_uuid(),

    vehicle_number text not null unique,

    driver_id uuid
        references public.profiles(id)
        on delete set null,

    ambulance_type text
        not null default 'Basic Life Support',

    status public.ambulance_status
        not null default 'available',

    latitude double precision,

    longitude double precision,

    equipment jsonb
        not null default '{}'::jsonb,

    created_at timestamptz
        not null default now(),

    updated_at timestamptz
        not null default now()
);


create table if not exists public.hospitals (

    id uuid primary key
        default gen_random_uuid(),

    name text not null,

    address text,

    latitude double precision,

    longitude double precision,

    emergency_available boolean
        not null default true,

    icu_available boolean
        not null default false,

    trauma_available boolean
        not null default false,

    cardiology_available boolean
        not null default false,

    created_at timestamptz
        not null default now(),

    updated_at timestamptz
        not null default now()
);


create table if not exists public.hospital_staff (

    id uuid primary key
        default gen_random_uuid(),

    hospital_id uuid not null
        references public.hospitals(id)
        on delete cascade,

    user_id uuid not null unique
        references public.profiles(id)
        on delete cascade,

    designation text,

    created_at timestamptz
        not null default now()
);


create table if not exists public.hospital_resources (

    id uuid primary key
        default gen_random_uuid(),

    hospital_id uuid not null
        references public.hospitals(id)
        on delete cascade,

    resource_type text not null,

    quantity integer
        not null default 0,

    available boolean
        not null default false,

    updated_at timestamptz
        not null default now()
);


create table if not exists public.emergencies (

    id uuid primary key
        default gen_random_uuid(),

    patient_id uuid
        references public.patients(id)
        on delete restrict,

    requester_id uuid
        references public.profiles(id)
        on delete set null,

    emergency_type text not null,

    priority public.emergency_priority
        not null default 'high',

    latitude double precision not null,

    longitude double precision not null,

    ambulance_id uuid
        references public.ambulances(id)
        on delete set null,

    hospital_id uuid
        references public.hospitals(id)
        on delete set null,

    status public.emergency_status
        not null default 'REPORTED',

    created_at timestamptz
        not null default now(),

    updated_at timestamptz
        not null default now()
);


create table if not exists public.emergency_events (

    id uuid primary key
        default gen_random_uuid(),

    emergency_id uuid not null
        references public.emergencies(id)
        on delete cascade,

    event_type text not null,

    description text,

    created_by uuid
        references public.profiles(id)
        on delete set null,

    created_at timestamptz
        not null default now()
);


create table if not exists public.ambulance_locations (

    id uuid primary key
        default gen_random_uuid(),

    ambulance_id uuid not null
        references public.ambulances(id)
        on delete cascade,

    emergency_id uuid
        references public.emergencies(id)
        on delete cascade,

    latitude double precision not null,

    longitude double precision not null,

    speed double precision,

    timestamp timestamptz
        not null default now()
);


create table if not exists public.patient_vitals (

    id uuid primary key
        default gen_random_uuid(),

    emergency_id uuid not null
        references public.emergencies(id)
        on delete cascade,

    heart_rate integer,

    spo2 numeric(5,2),

    blood_pressure text,

    temperature numeric(5,2),

    ecg_status text,

    recorded_at timestamptz
        not null default now()
);


create table if not exists public.notifications (

    id uuid primary key
        default gen_random_uuid(),

    user_id uuid
        references public.profiles(id)
        on delete cascade,

    emergency_id uuid
        references public.emergencies(id)
        on delete cascade,

    title text not null,

    message text not null,

    notification_type text
        not null default 'system',

    is_read boolean
        not null default false,

    created_at timestamptz
        not null default now()
);


/* =========================================================
   4. PATIENT UPGRADES
   ========================================================= */

alter table public.patients
    add column if not exists date_of_birth date;

alter table public.patients
    add column if not exists emergency_notes text;


/* =========================================================
   5. EMERGENCY CONTACT UPGRADES
   ========================================================= */

alter table public.emergency_contacts
    add column if not exists notification_enabled boolean
    not null default true;

alter table public.emergency_contacts
    add column if not exists access_enabled boolean
    not null default true;


/* =========================================================
   6. DRIVER / AMBULANCE UPGRADES
   ========================================================= */

alter table public.ambulances
    add column if not exists identity_document_type text;

alter table public.ambulances
    add column if not exists identity_verified boolean
    not null default false;

alter table public.ambulances
    add column if not exists last_location_at timestamptz;


/* =========================================================
   7. HOSPITAL STAFF UPGRADES
   ========================================================= */

alter table public.hospital_staff
    add column if not exists staff_id text;

alter table public.hospital_staff
    add column if not exists department text;

alter table public.hospital_staff
    add column if not exists reception_name text;

alter table public.hospital_staff
    add column if not exists reception_phone text;

alter table public.hospital_staff
    add column if not exists is_active boolean
    not null default true;


/* =========================================================
   8. HOSPITAL TEAMS
   ========================================================= */

create table if not exists public.hospital_teams (

    id uuid primary key
        default gen_random_uuid(),

    hospital_id uuid not null
        references public.hospitals(id)
        on delete cascade,

    team_name text not null,

    team_type text,

    members_count integer
        not null default 0,

    available_members integer
        not null default 0,

    status text
        not null default 'available',

    updated_at timestamptz
        not null default now(),

    created_at timestamptz
        not null default now(),

    constraint team_members_check
        check (
            members_count >= 0
        ),

    constraint team_available_members_check
        check (
            available_members >= 0
            and available_members <= members_count
        )
);


/* =========================================================
   9. HOSPITAL ROOMS
   ========================================================= */

create table if not exists public.hospital_rooms (

    id uuid primary key
        default gen_random_uuid(),

    hospital_id uuid not null
        references public.hospitals(id)
        on delete cascade,

    room_number text not null,

    room_type text not null
        default 'Emergency',

    status text not null
        default 'available',

    patient_id uuid
        references public.patients(id)
        on delete set null,

    emergency_id uuid
        references public.emergencies(id)
        on delete set null,

    floor_number integer,

    notes text,

    updated_at timestamptz
        not null default now(),

    created_at timestamptz
        not null default now()
);


/* =========================================================
   10. ICU BEDS
   ========================================================= */

create table if not exists public.hospital_icu_beds (

    id uuid primary key
        default gen_random_uuid(),

    hospital_id uuid not null
        references public.hospitals(id)
        on delete cascade,

    bed_number text not null,

    status text not null
        default 'available',

    patient_id uuid
        references public.patients(id)
        on delete set null,

    emergency_id uuid
        references public.emergencies(id)
        on delete set null,

    ventilator_available boolean
        not null default false,

    monitor_available boolean
        not null default false,

    notes text,

    updated_at timestamptz
        not null default now(),

    created_at timestamptz
        not null default now()
);


/* =========================================================
   11. INDIVIDUAL RESOURCE SLOTS
   ========================================================= */

create table if not exists public.hospital_resource_slots (

    id uuid primary key
        default gen_random_uuid(),

    hospital_id uuid not null
        references public.hospitals(id)
        on delete cascade,

    resource_type text not null,

    slot_code text not null,

    status text not null
        default 'available',

    patient_id uuid
        references public.patients(id)
        on delete set null,

    emergency_id uuid
        references public.emergencies(id)
        on delete set null,

    notes text,

    updated_at timestamptz
        not null default now(),

    created_at timestamptz
        not null default now(),

    constraint resource_slot_status_check
        check (
            status in (
                'available',
                'occupied',
                'maintenance',
                'reserved'
            )
        )
);


/* =========================================================
   12. RESOURCE ALLOCATIONS
   ========================================================= */

create table if not exists public.resource_allocations (

    id uuid primary key
        default gen_random_uuid(),

    hospital_id uuid not null
        references public.hospitals(id)
        on delete cascade,

    resource_slot_id uuid
        references public.hospital_resource_slots(id)
        on delete set null,

    resource_type text not null,

    patient_id uuid
        references public.patients(id)
        on delete set null,

    emergency_id uuid
        references public.emergencies(id)
        on delete set null,

    allocated_by uuid
        references public.profiles(id)
        on delete set null,

    status text not null
        default 'active',

    allocated_at timestamptz
        not null default now(),

    released_at timestamptz,

    notes text,

    constraint allocation_status_check
        check (
            status in (
                'active',
                'released',
                'cancelled'
            )
        )
);


/* =========================================================
   13. AUDIT LOG
   ========================================================= */

create table if not exists public.audit_logs (

    id uuid primary key
        default gen_random_uuid(),

    user_id uuid
        references public.profiles(id)
        on delete set null,

    emergency_id uuid
        references public.emergencies(id)
        on delete set null,

    action text not null,

    entity_type text,

    entity_id uuid,

    details jsonb
        not null default '{}'::jsonb,

    created_at timestamptz
        not null default now()
);


/* =========================================================
   14. UPDATED_AT FUNCTION
   ========================================================= */

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin

    new.updated_at = now();

    return new;

end;
$$;


/* =========================================================
   15. UPDATED_AT TRIGGERS
   ========================================================= */

drop trigger if exists profiles_updated_at
on public.profiles;

create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


drop trigger if exists patients_updated_at
on public.patients;

create trigger patients_updated_at
before update on public.patients
for each row
execute function public.set_updated_at();


drop trigger if exists ambulances_updated_at
on public.ambulances;

create trigger ambulances_updated_at
before update on public.ambulances
for each row
execute function public.set_updated_at();


drop trigger if exists hospitals_updated_at
on public.hospitals;

create trigger hospitals_updated_at
before update on public.hospitals
for each row
execute function public.set_updated_at();


drop trigger if exists hospital_resources_updated_at
on public.hospital_resources;

create trigger hospital_resources_updated_at
before update on public.hospital_resources
for each row
execute function public.set_updated_at();


drop trigger if exists emergencies_updated_at
on public.emergencies;

create trigger emergencies_updated_at
before update on public.emergencies
for each row
execute function public.set_updated_at();


drop trigger if exists hospital_teams_updated_at
on public.hospital_teams;

create trigger hospital_teams_updated_at
before update on public.hospital_teams
for each row
execute function public.set_updated_at();


drop trigger if exists hospital_rooms_updated_at
on public.hospital_rooms;

create trigger hospital_rooms_updated_at
before update on public.hospital_rooms
for each row
execute function public.set_updated_at();


drop trigger if exists hospital_icu_beds_updated_at
on public.hospital_icu_beds;

create trigger hospital_icu_beds_updated_at
before update on public.hospital_icu_beds
for each row
execute function public.set_updated_at();


drop trigger if exists hospital_resource_slots_updated_at
on public.hospital_resource_slots;

create trigger hospital_resource_slots_updated_at
before update on public.hospital_resource_slots
for each row
execute function public.set_updated_at();


/* =========================================================
   16. PROFILE CREATION
   ========================================================= */

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    insert into public.profiles (
        id,
        name,
        email,
        phone,
        role
    )

    values (
        new.id,

        coalesce(
            new.raw_user_meta_data ->> 'name',
            split_part(new.email, '@', 1)
        ),

        new.email,

        new.raw_user_meta_data ->> 'phone',

        case

            when lower(
                coalesce(
                    new.raw_user_meta_data ->> 'role',
                    'family'
                )
            ) = 'driver'

            then 'driver'::public.user_role


            when lower(
                coalesce(
                    new.raw_user_meta_data ->> 'role',
                    'family'
                )
            ) = 'hospital'

            then 'hospital'::public.user_role


            else 'family'::public.user_role

        end
    )

    on conflict (id)
    do update set

        name =
            excluded.name,

        email =
            excluded.email,

        phone =
            excluded.phone,

        role =
            excluded.role,

        updated_at =
            now();


    return new;

end;
$$;


drop trigger if exists on_auth_user_created
on auth.users;


create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


/* =========================================================
   17. SECURITY HELPER FUNCTIONS
   ========================================================= */

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
    select role
    from public.profiles
    where id = auth.uid()
    limit 1;
$$;


create or replace function public.is_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
        and role = 'driver'
    );
$$;


create or replace function public.is_hospital_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.hospital_staff
        where user_id = auth.uid()
        and is_active = true
    );
$$;


create or replace function public.user_hospital_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select hospital_id
    from public.hospital_staff
    where user_id = auth.uid()
    and is_active = true
    limit 1;
$$;


/* =========================================================
   18. INDEXES
   ========================================================= */

create index if not exists idx_profiles_role
on public.profiles(role);


create index if not exists idx_patients_user_id
on public.patients(user_id);


create index if not exists idx_contacts_patient_id
on public.emergency_contacts(patient_id);


create index if not exists idx_ambulances_status
on public.ambulances(status);


create index if not exists idx_ambulances_driver_id
on public.ambulances(driver_id);


create index if not exists idx_hospital_staff_hospital_id
on public.hospital_staff(hospital_id);


create index if not exists idx_hospital_staff_user_id
on public.hospital_staff(user_id);


create index if not exists idx_hospital_resources_hospital_id
on public.hospital_resources(hospital_id);


create index if not exists idx_emergencies_patient_id
on public.emergencies(patient_id);


create index if not exists idx_emergencies_requester_id
on public.emergencies(requester_id);


create index if not exists idx_emergencies_ambulance_id
on public.emergencies(ambulance_id);


create index if not exists idx_emergencies_hospital_id
on public.emergencies(hospital_id);


create index if not exists idx_emergencies_status
on public.emergencies(status);


create index if not exists idx_emergencies_created_at
on public.emergencies(created_at desc);


create index if not exists idx_emergency_events_emergency_id
on public.emergency_events(emergency_id);


create index if not exists idx_ambulance_locations_ambulance_id
on public.ambulance_locations(ambulance_id);


create index if not exists idx_ambulance_locations_emergency_id
on public.ambulance_locations(emergency_id);


create index if not exists idx_ambulance_locations_timestamp
on public.ambulance_locations(timestamp desc);


create index if not exists idx_patient_vitals_emergency_id
on public.patient_vitals(emergency_id);


create index if not exists idx_patient_vitals_recorded_at
on public.patient_vitals(recorded_at desc);


create index if not exists idx_notifications_user_id
on public.notifications(user_id);


create index if not exists idx_notifications_emergency_id
on public.notifications(emergency_id);


create index if not exists idx_hospital_teams_hospital_id
on public.hospital_teams(hospital_id);


create index if not exists idx_hospital_rooms_hospital_id
on public.hospital_rooms(hospital_id);


create index if not exists idx_hospital_rooms_status
on public.hospital_rooms(status);


create index if not exists idx_hospital_icu_hospital_id
on public.hospital_icu_beds(hospital_id);


create index if not exists idx_hospital_icu_status
on public.hospital_icu_beds(status);


create index if not exists idx_resource_slots_hospital_id
on public.hospital_resource_slots(hospital_id);


create index if not exists idx_resource_slots_status
on public.hospital_resource_slots(status);


create index if not exists idx_resource_allocations_hospital_id
on public.resource_allocations(hospital_id);


create index if not exists idx_resource_allocations_emergency_id
on public.resource_allocations(emergency_id);


create index if not exists idx_audit_logs_emergency_id
on public.audit_logs(emergency_id);


/* =========================================================
   19. ENABLE RLS
   ========================================================= */

alter table public.profiles
enable row level security;

alter table public.patients
enable row level security;

alter table public.emergency_contacts
enable row level security;

alter table public.ambulances
enable row level security;

alter table public.hospitals
enable row level security;

alter table public.hospital_staff
enable row level security;

alter table public.hospital_resources
enable row level security;

alter table public.emergencies
enable row level security;

alter table public.emergency_events
enable row level security;

alter table public.ambulance_locations
enable row level security;

alter table public.patient_vitals
enable row level security;

alter table public.notifications
enable row level security;

alter table public.hospital_teams
enable row level security;

alter table public.hospital_rooms
enable row level security;

alter table public.hospital_icu_beds
enable row level security;

alter table public.hospital_resource_slots
enable row level security;

alter table public.resource_allocations
enable row level security;

alter table public.audit_logs
enable row level security;


/* =========================================================
   20. PROFILES RLS
   ========================================================= */

drop policy if exists
"Users can view own profile"
on public.profiles;

create policy
"Users can view own profile"
on public.profiles
for select
to authenticated
using (
    id = auth.uid()
);


drop policy if exists
"Users can update own profile"
on public.profiles;

create policy
"Users can update own profile"
on public.profiles
for update
to authenticated
using (
    id = auth.uid()
)
with check (
    id = auth.uid()
);


/* =========================================================
   21. PATIENT RLS
   ========================================================= */

drop policy if exists
"Users can view authorized patients"
on public.patients;

create policy
"Users can view authorized patients"
on public.patients
for select
to authenticated
using (

    user_id = auth.uid()

    or exists (
        select 1
        from public.emergencies e
        where e.patient_id = patients.id
        and (
            e.requester_id = auth.uid()

            or exists (
                select 1
                from public.ambulances a
                where a.id = e.ambulance_id
                and a.driver_id = auth.uid()
            )

            or exists (
                select 1
                from public.hospital_staff hs
                where hs.hospital_id = e.hospital_id
                and hs.user_id = auth.uid()
                and hs.is_active = true
            )
        )
    )
);


drop policy if exists
"Users can insert own patients"
on public.patients;

create policy
"Users can insert own patients"
on public.patients
for insert
to authenticated
with check (
    user_id = auth.uid()
);


drop policy if exists
"Users can update own patients"
on public.patients;

create policy
"Users can update own patients"
on public.patients
for update
to authenticated
using (
    user_id = auth.uid()
)
with check (
    user_id = auth.uid()
);


/* =========================================================
   22. EMERGENCY CONTACT RLS
   ========================================================= */

drop policy if exists
"Authorized users can view emergency contacts"
on public.emergency_contacts;

create policy
"Authorized users can view emergency contacts"
on public.emergency_contacts
for select
to authenticated
using (

    exists (
        select 1
        from public.patients p
        where p.id =
            emergency_contacts.patient_id

        and (
            p.user_id = auth.uid()

            or exists (
                select 1
                from public.emergencies e
                where e.patient_id = p.id
                and (
                    e.requester_id = auth.uid()

                    or exists (
                        select 1
                        from public.ambulances a
                        where a.id = e.ambulance_id
                        and a.driver_id = auth.uid()
                    )

                    or exists (
                        select 1
                        from public.hospital_staff hs
                        where hs.hospital_id = e.hospital_id
                        and hs.user_id = auth.uid()
                    )
                )
            )
        )
    )
);


drop policy if exists
"Users can insert own emergency contacts"
on public.emergency_contacts;

create policy
"Users can insert own emergency contacts"
on public.emergency_contacts
for insert
to authenticated
with check (
    exists (
        select 1
        from public.patients p
        where p.id =
            emergency_contacts.patient_id
        and p.user_id =
            auth.uid()
    )
);


/* =========================================================
   23. AMBULANCE RLS
   ========================================================= */

drop policy if exists
"Authenticated users can view ambulances"
on public.ambulances;

create policy
"Authenticated users can view ambulances"
on public.ambulances
for select
to authenticated
using (
    true
);


drop policy if exists
"Drivers can update assigned ambulance"
on public.ambulances;

create policy
"Drivers can update assigned ambulance"
on public.ambulances
for update
to authenticated
using (
    driver_id = auth.uid()
)
with check (
    driver_id = auth.uid()
);


/* =========================================================
   24. HOSPITAL RLS
   ========================================================= */

drop policy if exists
"Authenticated users can view hospitals"
on public.hospitals;

create policy
"Authenticated users can view hospitals"
on public.hospitals
for select
to authenticated
using (
    true
);


drop policy if exists
"Hospital staff can update hospital"
on public.hospitals;

create policy
"Hospital staff can update hospital"
on public.hospitals
for update
to authenticated
using (
    exists (
        select 1
        from public.hospital_staff hs
        where hs.hospital_id = hospitals.id
        and hs.user_id = auth.uid()
        and hs.is_active = true
    )
)
with check (
    exists (
        select 1
        from public.hospital_staff hs
        where hs.hospital_id = hospitals.id
        and hs.user_id = auth.uid()
        and hs.is_active = true
    )
);


/* =========================================================
   25. HOSPITAL STAFF RLS
   ========================================================= */

drop policy if exists
"Hospital staff can view own assignment"
on public.hospital_staff;

create policy
"Hospital staff can view own assignment"
on public.hospital_staff
for select
to authenticated
using (
    user_id = auth.uid()
);


drop policy if exists
"Hospital staff can view hospital staff"
on public.hospital_staff;

create policy
"Hospital staff can view hospital staff"
on public.hospital_staff
for select
to authenticated
using (
    hospital_id = public.user_hospital_id()
);


/* =========================================================
   26. HOSPITAL RESOURCES RLS
   ========================================================= */

drop policy if exists
"Authenticated users can view hospital resources"
on public.hospital_resources;

create policy
"Authenticated users can view hospital resources"
on public.hospital_resources
for select
to authenticated
using (
    true
);


drop policy if exists
"Hospital staff can update resources"
on public.hospital_resources;

create policy
"Hospital staff can update resources"
on public.hospital_resources
for update
to authenticated
using (
    hospital_id =
        public.user_hospital_id()
)
with check (
    hospital_id =
        public.user_hospital_id()
);


/* =========================================================
   27. HOSPITAL TEAMS RLS
   ========================================================= */

drop policy if exists
"Users can view hospital teams"
on public.hospital_teams;

create policy
"Users can view hospital teams"
on public.hospital_teams
for select
to authenticated
using (
    true
);


drop policy if exists
"Hospital staff can manage teams"
on public.hospital_teams;

create policy
"Hospital staff can manage teams"
on public.hospital_teams
for all
to authenticated
using (
    hospital_id =
        public.user_hospital_id()
)
with check (
    hospital_id =
        public.user_hospital_id()
);


/* =========================================================
   28. HOSPITAL ROOMS RLS
   ========================================================= */

drop policy if exists
"Users can view hospital rooms"
on public.hospital_rooms;

create policy
"Users can view hospital rooms"
on public.hospital_rooms
for select
to authenticated
using (
    true
);


drop policy if exists
"Hospital staff can manage rooms"
on public.hospital_rooms;

create policy
"Hospital staff can manage rooms"
on public.hospital_rooms
for all
to authenticated
using (
    hospital_id =
        public.user_hospital_id()
)
with check (
    hospital_id =
        public.user_hospital_id()
);


/* =========================================================
   29. ICU RLS
   ========================================================= */

drop policy if exists
"Users can view ICU beds"
on public.hospital_icu_beds;

create policy
"Users can view ICU beds"
on public.hospital_icu_beds
for select
to authenticated
using (
    true
);


drop policy if exists
"Hospital staff can manage ICU beds"
on public.hospital_icu_beds;

create policy
"Hospital staff can manage ICU beds"
on public.hospital_icu_beds
for all
to authenticated
using (
    hospital_id =
        public.user_hospital_id()
)
with check (
    hospital_id =
        public.user_hospital_id()
);


/* =========================================================
   30. RESOURCE SLOTS RLS
   ========================================================= */

drop policy if exists
"Users can view resource slots"
on public.hospital_resource_slots;

create policy
"Users can view resource slots"
on public.hospital_resource_slots
for select
to authenticated
using (
    true
);


drop policy if exists
"Hospital staff can manage resource slots"
on public.hospital_resource_slots;

create policy
"Hospital staff can manage resource slots"
on public.hospital_resource_slots
for all
to authenticated
using (
    hospital_id =
        public.user_hospital_id()
)
with check (
    hospital_id =
        public.user_hospital_id()
);


/* =========================================================
   31. RESOURCE ALLOCATION RLS
   ========================================================= */

drop policy if exists
"Hospital staff can view allocations"
on public.resource_allocations;

create policy
"Hospital staff can view allocations"
on public.resource_allocations
for select
to authenticated
using (
    hospital_id =
        public.user_hospital_id()
);


drop policy if exists
"Hospital staff can create allocations"
on public.resource_allocations;

create policy
"Hospital staff can create allocations"
on public.resource_allocations
for insert
to authenticated
with check (
    hospital_id =
        public.user_hospital_id()
    and allocated_by =
        auth.uid()
);


drop policy if exists
"Hospital staff can update allocations"
on public.resource_allocations;

create policy
"Hospital staff can update allocations"
on public.resource_allocations
for update
to authenticated
using (
    hospital_id =
        public.user_hospital_id()
)
with check (
    hospital_id =
        public.user_hospital_id()
);


/* =========================================================
   32. EMERGENCIES RLS
   ========================================================= */

drop policy if exists
"Authorized users can view emergencies"
on public.emergencies;

create policy
"Authorized users can view emergencies"
on public.emergencies
for select
to authenticated
using (

    requester_id = auth.uid()

    or exists (
        select 1
        from public.patients p
        where p.id = emergencies.patient_id
        and p.user_id = auth.uid()
    )

    or exists (
        select 1
        from public.ambulances a
        where a.id = emergencies.ambulance_id
        and a.driver_id = auth.uid()
    )

    or exists (
        select 1
        from public.hospital_staff hs
        where hs.hospital_id = emergencies.hospital_id
        and hs.user_id = auth.uid()
        and hs.is_active = true
    )
);


drop policy if exists
"Authenticated users can create emergencies"
on public.emergencies;

create policy
"Authenticated users can create emergencies"
on public.emergencies
for insert
to authenticated
with check (

    requester_id = auth.uid()

    and (
        patient_id is null

        or exists (
            select 1
            from public.patients p
            where p.id = emergencies.patient_id
            and p.user_id = auth.uid()
        )
    )
);


drop policy if exists
"Authorized users can update emergencies"
on public.emergencies;

create policy
"Authorized users can update emergencies"
on public.emergencies
for update
to authenticated
using (

    requester_id = auth.uid()

    or exists (
        select 1
        from public.ambulances a
        where a.id = emergencies.ambulance_id
        and a.driver_id = auth.uid()
    )

    or exists (
        select 1
        from public.hospital_staff hs
        where hs.hospital_id = emergencies.hospital_id
        and hs.user_id = auth.uid()
        and hs.is_active = true
    )
)
with check (

    requester_id = auth.uid()

    or exists (
        select 1
        from public.ambulances a
        where a.id = emergencies.ambulance_id
        and a.driver_id = auth.uid()
    )

    or exists (
        select 1
        from public.hospital_staff hs
        where hs.hospital_id = emergencies.hospital_id
        and hs.user_id = auth.uid()
        and hs.is_active = true
    )
);


/* =========================================================
   33. EMERGENCY EVENTS
   ========================================================= */

drop policy if exists
"Authorized users can view emergency events"
on public.emergency_events;

create policy
"Authorized users can view emergency events"
on public.emergency_events
for select
to authenticated
using (

    exists (
        select 1
        from public.emergencies e
        where e.id =
            emergency_events.emergency_id

        and (
            e.requester_id = auth.uid()

            or exists (
                select 1
                from public.ambulances a
                where a.id = e.ambulance_id
                and a.driver_id = auth.uid()
            )

            or exists (
                select 1
                from public.hospital_staff hs
                where hs.hospital_id = e.hospital_id
                and hs.user_id = auth.uid()
            )

            or exists (
                select 1
                from public.patients p
                where p.id = e.patient_id
                and p.user_id = auth.uid()
            )
        )
    )
);


drop policy if exists
"Authenticated users can create emergency events"
on public.emergency_events;

create policy
"Authenticated users can create emergency events"
on public.emergency_events
for insert
to authenticated
with check (
    created_by = auth.uid()
);


/* =========================================================
   34. AMBULANCE LOCATIONS
   ========================================================= */

drop policy if exists
"Authorized users can view ambulance locations"
on public.ambulance_locations;

create policy
"Authorized users can view ambulance locations"
on public.ambulance_locations
for select
to authenticated
using (

    exists (
        select 1
        from public.emergencies e
        where e.id =
            ambulance_locations.emergency_id

        and (
            e.requester_id = auth.uid()

            or exists (
                select 1
                from public.ambulances a
                where a.id = e.ambulance_id
                and a.driver_id = auth.uid()
            )

            or exists (
                select 1
                from public.hospital_staff hs
                where hs.hospital_id = e.hospital_id
                and hs.user_id = auth.uid()
            )
        )
    )
);


drop policy if exists
"Drivers can insert ambulance locations"
on public.ambulance_locations;

create policy
"Drivers can insert ambulance locations"
on public.ambulance_locations
for insert
to authenticated
with check (

    exists (
        select 1
        from public.ambulances a
        where a.id =
            ambulance_locations.ambulance_id

        and a.driver_id =
            auth.uid()
    )
);


/* =========================================================
   35. PATIENT VITALS
   ========================================================= */

drop policy if exists
"Authorized users can view patient vitals"
on public.patient_vitals;

create policy
"Authorized users can view patient vitals"
on public.patient_vitals
for select
to authenticated
using (

    exists (
        select 1
        from public.emergencies e
        where e.id =
            patient_vitals.emergency_id

        and (
            e.requester_id = auth.uid()

            or exists (
                select 1
                from public.ambulances a
                where a.id = e.ambulance_id
                and a.driver_id = auth.uid()
            )

            or exists (
                select 1
                from public.hospital_staff hs
                where hs.hospital_id = e.hospital_id
                and hs.user_id = auth.uid()
            )
        )
    )
);


drop policy if exists
"Authorized users can insert patient vitals"
on public.patient_vitals;

create policy
"Authorized users can insert patient vitals"
on public.patient_vitals
for insert
to authenticated
with check (

    exists (
        select 1
        from public.emergencies e
        where e.id =
            patient_vitals.emergency_id

        and (
            exists (
                select 1
                from public.ambulances a
                where a.id = e.ambulance_id
                and a.driver_id = auth.uid()
            )

            or exists (
                select 1
                from public.hospital_staff hs
                where hs.hospital_id = e.hospital_id
                and hs.user_id = auth.uid()
            )
        )
    )
);


/* =========================================================
   36. NOTIFICATIONS
   ========================================================= */

drop policy if exists
"Users can view own notifications"
on public.notifications;

create policy
"Users can view own notifications"
on public.notifications
for select
to authenticated
using (
    user_id = auth.uid()
);


drop policy if exists
"Users can update own notifications"
on public.notifications;

create policy
"Users can update own notifications"
on public.notifications
for update
to authenticated
using (
    user_id = auth.uid()
)
with check (
    user_id = auth.uid()
);


/* =========================================================
   37. AUDIT LOGS
   ========================================================= */

drop policy if exists
"Users can view own audit logs"
on public.audit_logs;

create policy
"Users can view own audit logs"
on public.audit_logs
for select
to authenticated
using (
    user_id = auth.uid()
);


/* =========================================================
   38. GUEST EMERGENCY FUNCTION
   ========================================================= */

/*
   The browser must NOT receive a service-role key.

   This function provides a controlled database entry point
   for the public emergency button.

   It intentionally accepts only:
   - emergency type
   - priority
   - latitude
   - longitude

   It creates an emergency without an authenticated user.

   For a real deployment, put rate limiting / CAPTCHA /
   abuse protection in front of this function.
*/

create or replace function public.create_guest_emergency(
    p_emergency_type text,
    p_priority public.emergency_priority,
    p_latitude double precision,
    p_longitude double precision
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    new_emergency_id uuid;
begin

    if p_emergency_type is null
       or length(trim(p_emergency_type)) = 0 then

        raise exception
            'Emergency type is required';

    end if;


    if p_latitude < -90
       or p_latitude > 90 then

        raise exception
            'Invalid latitude';

    end if;


    if p_longitude < -180
       or p_longitude > 180 then

        raise exception
            'Invalid longitude';

    end if;


    insert into public.emergencies (

        patient_id,

        requester_id,

        emergency_type,

        priority,

        latitude,

        longitude,

        status

    )

    values (

        null,

        null,

        trim(p_emergency_type),

        coalesce(
            p_priority,
            'high'
        ),

        p_latitude,

        p_longitude,

        'REPORTED'

    )

    returning id
    into new_emergency_id;


    insert into public.emergency_events (

        emergency_id,

        event_type,

        description,

        created_by

    )

    values (

        new_emergency_id,

        'GUEST_EMERGENCY_CREATED',

        'Emergency request created through public emergency access.',

        null

    );


    return new_emergency_id;

end;
$$;


/* =========================================================
   39. FUNCTION PERMISSIONS
   ========================================================= */

revoke all
on function public.create_guest_emergency(
    text,
    public.emergency_priority,
    double precision,
    double precision
)
from public;


grant execute
on function public.create_guest_emergency(
    text,
    public.emergency_priority,
    double precision,
    double precision
)
to anon;


grant execute
on function public.create_guest_emergency(
    text,
    public.emergency_priority,
    double precision,
    double precision
)
to authenticated;


/* =========================================================
   40. REALTIME
   ========================================================= */

do $$
declare

    tables_to_add text[] := array[
        'emergencies',
        'emergency_events',
        'ambulance_locations',
        'patient_vitals',
        'ambulances',
        'hospitals',
        'hospital_resources',
        'hospital_teams',
        'hospital_rooms',
        'hospital_icu_beds',
        'hospital_resource_slots',
        'resource_allocations',
        'notifications'
    ];

    table_name text;

begin

    foreach table_name
    in array tables_to_add

    loop

        begin

            execute format(
                'alter publication supabase_realtime add table public.%I',
                table_name
            );

        exception
            when duplicate_object then
                null;

        end;

    end loop;

end
$$;


/* =========================================================
   41. REALTIME REPLICA IDENTITY
   ========================================================= */

alter table public.emergencies
replica identity full;

alter table public.emergency_events
replica identity full;

alter table public.ambulance_locations
replica identity full;

alter table public.patient_vitals
replica identity full;

alter table public.ambulances
replica identity full;

alter table public.hospitals
replica identity full;

alter table public.hospital_resources
replica identity full;

alter table public.hospital_teams
replica identity full;

alter table public.hospital_rooms
replica identity full;

alter table public.hospital_icu_beds
replica identity full;

alter table public.hospital_resource_slots
replica identity full;

alter table public.resource_allocations
replica identity full;

alter table public.notifications
replica identity full;


/* =========================================================
   42. SAMPLE HOSPITAL
   ========================================================= */

insert into public.hospitals (

    name,

    address,

    latitude,

    longitude,

    emergency_available,

    icu_available,

    trauma_available,

    cardiology_available

)

select

    'ResQ Central Emergency Hospital',

    'Demo Location',

    30.7333,

    76.7794,

    true,

    true,

    true,

    true

where not exists (

    select 1
    from public.hospitals
    where name =
        'ResQ Central Emergency Hospital'
);


/* =========================================================
   43. SAMPLE HOSPITAL RESOURCES
   ========================================================= */

insert into public.hospital_resources (

    hospital_id,

    resource_type,

    quantity,

    available

)

select

    h.id,

    r.resource_type,

    r.quantity,

    r.available

from public.hospitals h

cross join (

    values

        ('ICU Beds', 8, true),

        ('Emergency Beds', 12, true),

        ('Ventilators', 5, true),

        ('Trauma Rooms', 3, true),

        ('Cardiology Beds', 4, true)

) as r(
    resource_type,
    quantity,
    available
)

where h.name =
    'ResQ Central Emergency Hospital'

and not exists (

    select 1
    from public.hospital_resources hr

    where hr.hospital_id =
        h.id

    and hr.resource_type =
        r.resource_type
);


/* =========================================================
   44. SAMPLE RESOURCE SLOTS
   ========================================================= */

do $$
declare

    h_id uuid;

    i integer;

begin

    select id
    into h_id
    from public.hospitals
    where name =
        'ResQ Central Emergency Hospital'
    limit 1;


    if h_id is null then
        return;
    end if;


    for i in 1..12 loop

        insert into public.hospital_resource_slots (

            hospital_id,

            resource_type,

            slot_code,

            status

        )

        values (

            h_id,

            'Emergency Bed',

            'ER-' ||
                lpad(
                    i::text,
                    2,
                    '0'
                ),

            'available'

        )

        on conflict do nothing;

    end loop;


    for i in 1..8 loop

        insert into public.hospital_resource_slots (

            hospital_id,

            resource_type,

            slot_code,

            status

        )

        values (

            h_id,

            'ICU Bed',

            'ICU-' ||
                lpad(
                    i::text,
                    2,
                    '0'
                ),

            'available'

        )

        on conflict do nothing;

    end loop;


    for i in 1..3 loop

        insert into public.hospital_resource_slots (

            hospital_id,

            resource_type,

            slot_code,

            status

        )

        values (

            h_id,

            'Trauma Room',

            'TR-' ||
                lpad(
                    i::text,
                    2,
                    '0'
                ),

            'available'

        )

        on conflict do nothing;

    end loop;

end
$$;


/* =========================================================
   45. SAMPLE TEAMS
   ========================================================= */

insert into public.hospital_teams (

    hospital_id,

    team_name,

    team_type,

    members_count,

    available_members,

    status

)

select

    h.id,

    t.team_name,

    t.team_type,

    t.members_count,

    t.available_members,

    'available'

from public.hospitals h

cross join (

    values

        (
            'Emergency Response Team',
            'Emergency',
            8,
            8
        ),

        (
            'Trauma Team',
            'Trauma',
            6,
            5
        ),

        (
            'Cardiac Team',
            'Cardiology',
            5,
            4
        )

) as t(
    team_name,
    team_type,
    members_count,
    available_members
)

where h.name =
    'ResQ Central Emergency Hospital'

and not exists (

    select 1
    from public.hospital_teams ht

    where ht.hospital_id =
        h.id

    and ht.team_name =
        t.team_name
);


/* =========================================================
   46. FINAL VERIFICATION
   ========================================================= */

select
    'profiles' as table_name,
    count(*) as rows
from public.profiles

union all

select
    'patients',
    count(*)
from public.patients

union all

select
    'emergency_contacts',
    count(*)
from public.emergency_contacts

union all

select
    'ambulances',
    count(*)
from public.ambulances

union all

select
    'hospitals',
    count(*)
from public.hospitals

union all

select
    'hospital_staff',
    count(*)
from public.hospital_staff

union all

select
    'hospital_resources',
    count(*)
from public.hospital_resources

union all

select
    'hospital_teams',
    count(*)
from public.hospital_teams

union all

select
    'hospital_rooms',
    count(*)
from public.hospital_rooms

union all

select
    'hospital_icu_beds',
    count(*)
from public.hospital_icu_beds

union all

select
    'hospital_resource_slots',
    count(*)
from public.hospital_resource_slots

union all

select
    'resource_allocations',
    count(*)
from public.resource_allocations

union all

select
    'emergencies',
    count(*)
from public.emergencies

union all

select
    'emergency_events',
    count(*)
from public.emergency_events

union all

select
    'ambulance_locations',
    count(*)
from public.ambulance_locations

union all

select
    'patient_vitals',
    count(*)
from public.patient_vitals

union all

select
    'notifications',
    count(*)
from public.notifications

union all

select
    'audit_logs',
    count(*)
from public.audit_logs;