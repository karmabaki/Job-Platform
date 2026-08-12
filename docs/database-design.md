# Database Design — MVP

Scope: `users`, `candidate_profiles`, `companies`, `countries`, `skills`,
`skill_aliases`, `candidate_skills`, `jobs`, `job_skills`, `applications`.

This is a design document only. No schema code, no migrations, no packages
installed. Types are written in PostgreSQL terms; the Drizzle schema is a
later, separate step.

All primary keys are `uuid` (default `gen_random_uuid()`) unless noted — see
[Open questions #1](#open-questions) for why this needed an assumption.

---

## countries

Reference table. Seeded by a migration, not written to by the app at
runtime.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| code | char(2) | not null | — | ISO 3166-1 alpha-2 |
| name | text | not null | — | display name |

- **Primary key:** `code`
- **Foreign keys:** none
- **Unique constraints:** `name`
- **Indexes:** none beyond the primary key (table is small and always read
  by `code`)

---

## users

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | not null | `gen_random_uuid()` | |
| email | text | not null | — | login identity |
| password_hash | text | not null | — | never returned in API responses |
| role | text | not null | — | `CHECK (role IN ('candidate','employer','admin'))` |
| company_id | uuid | null | — | set only when `role = 'employer'` |
| created_at | timestamptz | not null | `now()` | |
| updated_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `company_id` → `companies(id)` **ON DELETE SET NULL** — losing the
    company record shouldn't delete the user account, just detach it
- **Unique constraints:** `email`
- **Indexes:**
  - unique index on `email` — every login looks up by email
  - index on `company_id` — "list employer users for this company" (admin
    tooling, employer team views)

---

## candidate_profiles

One-to-one with `users` (only for `role = 'candidate'`).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | not null | `gen_random_uuid()` | |
| user_id | uuid | not null | — | |
| full_name | text | not null | — | |
| headline | text | null | — | e.g. "Senior Backend Engineer" |
| bio | text | null | — | |
| github_url | text | null | — | |
| portfolio_url | text | null | — | |
| country_code | char(2) | not null | — | candidate_country |
| timezone | text | not null | — | IANA tz name, e.g. `Asia/Tehran` |
| availability | text | not null | — | `CHECK (availability IN ('full_time','part_time','contract'))` — see [Open questions #3](#open-questions) |
| salary_expectation_min | integer | null | — | see [Key decision #2](#key-decisions) |
| salary_expectation_max | integer | null | — | |
| salary_currency | char(3) | null | — | ISO 4217, required together with min/max at the app layer |
| salary_period | text | null | — | `CHECK (salary_period IN ('yearly','monthly','hourly'))` |
| created_at | timestamptz | not null | `now()` | |
| updated_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `user_id` → `users(id)` **ON DELETE CASCADE** — profile has no meaning
    without its user
  - `country_code` → `countries(code)` **ON DELETE RESTRICT** — a country
    in active use by a profile can't disappear out from under it
- **Unique constraints:** `user_id` (enforces one-to-one)
- **Indexes:**
  - unique index on `user_id` — also serves the "load my profile" lookup
  - index on `country_code` — candidate search/filter by location
  - index on `availability` — job-search filtering

---

## companies

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | not null | `gen_random_uuid()` | |
| name | text | not null | — | see [Open questions #8](#open-questions) — not unique |
| website | text | null | — | |
| country_code | char(2) | not null | — | employer_country, see [Key decision #2](#key-decisions) |
| description | text | null | — | |
| created_at | timestamptz | not null | `now()` | |
| updated_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `country_code` → `countries(code)` **ON DELETE RESTRICT**
- **Unique constraints:** none
- **Indexes:**
  - index on `country_code` — filtering jobs/companies by employer
    country, and future salary-intelligence aggregation by country

---

## skills

Admin-curated vocabulary — see [Key decision #1](#key-decisions).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | not null | `gen_random_uuid()` | |
| slug | text | not null | — | stable identity, e.g. `react` |
| name | text | not null | — | display name, e.g. "React" |
| category | text | null | — | e.g. `language`, `framework` — see [Open questions #7](#open-questions) |
| is_active | boolean | not null | `true` | soft-disable instead of delete |
| created_at | timestamptz | not null | `now()` | |
| updated_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:** none
- **Unique constraints:** `slug`
- **Indexes:**
  - unique index on `slug` — canonical lookup and admin dedupe on create
  - index on `name` — search/autocomplete when adding a skill

---

## skill_aliases

Maps free-text variants ("JS", "ReactJS") to one canonical skill — see
[Key decision #1](#key-decisions).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | not null | `gen_random_uuid()` | |
| skill_id | uuid | not null | — | |
| alias | text | not null | — | |
| created_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `skill_id` → `skills(id)` **ON DELETE CASCADE** — an alias is
    meaningless without its canonical skill
- **Unique constraints:** `alias` — one alias string can only ever point at
  one canonical skill, otherwise lookup is ambiguous
- **Indexes:**
  - unique index on `alias` — this table's entire purpose is
    "look up by alias text"
  - index on `skill_id` — "list all known variants for this skill" (admin
    UI)

---

## candidate_skills

Join table between candidates and skills.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| candidate_id | uuid | not null | — | |
| skill_id | uuid | not null | — | |
| years_experience | smallint | null | — | see [Open questions #6](#open-questions) |
| created_at | timestamptz | not null | `now()` | |

- **Primary key:** composite `(candidate_id, skill_id)` — a candidate lists
  a given skill at most once
- **Foreign keys:**
  - `candidate_id` → `candidate_profiles(id)` **ON DELETE CASCADE**
  - `skill_id` → `skills(id)` **ON DELETE RESTRICT** — retire a skill via
    `is_active`, don't delete it out from under existing candidates
- **Unique constraints:** none beyond the composite primary key
- **Indexes:**
  - index on `skill_id` — "which candidates have skill X" — the core
    query any future matching feature runs (the primary key already
    indexes lookups the other direction, by `candidate_id`)

---

## jobs

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | not null | `gen_random_uuid()` | |
| company_id | uuid | not null | — | |
| created_by | uuid | null | — | employer user who posted it |
| title | text | not null | — | |
| description | text | not null | — | |
| status | text | not null | `'draft'` | `CHECK (status IN ('draft','published','closed'))` |
| salary_min | integer | null | — | see [Key decision #2](#key-decisions) |
| salary_max | integer | null | — | |
| salary_currency | char(3) | null | — | |
| salary_period | text | null | — | `CHECK (salary_period IN ('yearly','monthly','hourly'))` |
| timezone_requirement | text | null | — | see [Open questions #5](#open-questions) |
| created_at | timestamptz | not null | `now()` | |
| updated_at | timestamptz | not null | `now()` | |

Note: employer_country is **not** a column here — it's read via
`jobs.company_id → companies.country_code` (see
[Key decision #2](#key-decisions)) to avoid duplicating data that could
drift out of sync.

- **Primary key:** `id`
- **Foreign keys:**
  - `company_id` → `companies(id)` **ON DELETE CASCADE** — a job posting
    has no meaning once its company is gone
  - `created_by` → `users(id)` **ON DELETE SET NULL** — if the employer
    user who posted it is removed, the posting stays with the company
- **Unique constraints:** none
- **Indexes:**
  - index on `company_id` — employer dashboard, "jobs for my company"
  - composite index on `(status, created_at)` — the public job feed:
    published jobs, newest first
  - index on `created_by` — "jobs I personally posted"

---

## job_skills

Join table between jobs and skills.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| job_id | uuid | not null | — | |
| skill_id | uuid | not null | — | |
| is_required | boolean | not null | `true` | see [Open questions #6](#open-questions) |
| created_at | timestamptz | not null | `now()` | |

- **Primary key:** composite `(job_id, skill_id)`
- **Foreign keys:**
  - `job_id` → `jobs(id)` **ON DELETE CASCADE**
  - `skill_id` → `skills(id)` **ON DELETE RESTRICT**
- **Unique constraints:** none beyond the composite primary key
- **Indexes:**
  - index on `skill_id` — "which jobs need skill X" — the other half of
    the matching-engine core query

---

## applications

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | not null | `gen_random_uuid()` | |
| job_id | uuid | not null | — | |
| candidate_id | uuid | not null | — | |
| status | text | not null | `'applied'` | `CHECK (status IN ('applied','shortlisted','rejected','hired'))` |
| cover_note | text | null | — | |
| created_at | timestamptz | not null | `now()` | |
| updated_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `job_id` → `jobs(id)` **ON DELETE CASCADE** — applications are
    meaningless once the job posting is gone
  - `candidate_id` → `candidate_profiles(id)` **ON DELETE CASCADE**
- **Unique constraints:** `(job_id, candidate_id)` — a candidate can apply
  to a given job only once
- **Indexes:**
  - index on `candidate_id` — candidate's "my applications" dashboard
    (the unique constraint's backing index already covers `job_id` first,
    so this covers the other lookup direction)
  - composite index on `(job_id, status)` — employer's applicant list
    filtered/grouped by pipeline stage

---

## Key decisions

### 1. Skills are admin-curated with a unique slug, plus `skill_aliases`

**Choice:** `skills` is a closed vocabulary maintained by admins. Each row
has a stable `slug` as its true identity. `skill_aliases` maps free-text
variants ("JS", "java script") to one canonical `skill_id`, used at
input-normalization time (autocomplete, search) rather than storing
free text directly in `candidate_skills` / `job_skills`.

**Tradeoff:** curation is a manual bottleneck — a candidate or employer
can't add a skill that doesn't exist yet, which is real friction early on
when the vocabulary is thin. This is accepted because clean, deduplicated
skill data is a hard prerequisite for any future matching algorithm:
free-text skills would make "does this candidate match this job" an NLP
problem instead of a join.

### 2. Salary shape: min, max, currency, salary_period, integer only, both countries

**Choice:** salary bounds are stored as **integer** amounts — never
float — paired with a `currency` code and a `salary_period` enum
(yearly/monthly/hourly). `candidate_country` lives on `candidate_profiles`;
`employer_country` is **not** duplicated onto `jobs` — it's read through
`jobs.company_id → companies.country_code`.

**Tradeoff:** integers eliminate floating-point rounding bugs in money
math, but push "what unit is this integer in" entirely onto
`currency` + `salary_period` — the app layer must never assume cents or
any other sub-unit, since currencies don't agree on sub-units (USD has
cents, JPY has none). Cross-currency comparison (e.g. sorting jobs by
salary across USD and EUR) isn't possible in SQL today and needs a real
conversion step, which is exactly the future "salary intelligence" work —
this schema stores the honest inputs for that, not a pre-converted value
that would go stale.

### 3. Status-like columns use `text` + `CHECK`, not `pgEnum`

**Choice:** every categorical column with a fixed vocabulary
(`users.role`, `jobs.status`, `applications.status`,
`candidate_profiles.availability`, `salary_period`) is `text` with a
`CHECK` constraint, not a native Postgres `ENUM` type.

**Tradeoff:** a native `pgEnum` gets you a real type and slightly smaller
storage, but adding a new value later requires `ALTER TYPE ... ADD VALUE`,
which historically can't run inside the same transaction as other DDL and
is exactly the kind of migration friction this phase is trying to avoid.
`text` + `CHECK` only needs a plain `ALTER TABLE ... DROP CONSTRAINT` /
`ADD CONSTRAINT` to change the allowed set, and maps directly onto
Drizzle's schema-as-code without a separate enum-type migration step. The
cost: the database won't catch a typo'd status string at the type level
the way an enum would — correctness depends on the `CHECK` constraint (and
matching app-layer types) being kept in sync by hand.

### 4. Employer-to-company relationship for the MVP

**Choice:** one company has many employer users
(`users.company_id → companies.id`, nullable — candidates have no
company). A user belongs to at most one company.

**Tradeoff:** this doesn't support one person representing multiple
companies (e.g. a recruiting agency posting for several clients) or a
company shared across logins without a shared company record. Acceptable
for MVP since CLAUDE.md describes direct-hire "companies in the US and
Europe," not agencies. If that changes, it becomes a `company_members`
join table later — deliberately not built now, per CLAUDE.md's
"do not introduce unnecessary abstractions."

### 5. Supporting future matching and salary intelligence without a major migration

- `candidate_skills` and `job_skills` already exist as the exact join
  tables a matching feature needs, each indexed on `skill_id` in both
  directions — a first matching pass is a read-only SQL join over data
  that already exists, not a schema change.
- `skills.slug` + `skill_aliases` guarantee matching starts from a
  deduplicated vocabulary — "React" and "ReactJS" are never silently
  treated as two different skills once matching logic depends on exact
  `skill_id` equality.
- `skills.is_active` lets a skill be retired without deleting rows that
  reference it, so historical `candidate_skills` / `job_skills` data
  survives for any algorithm trained or run against it later.
- Salary fields (`salary_min`, `salary_max`, `currency`, `salary_period`,
  plus `candidate_country` / `employer_country` via `companies`) are
  already shaped for a future salary-intelligence job that aggregates by
  country, currency, and period — no new columns needed, only new
  read-only aggregation queries.
- **What this does not cover:** there is no `match_scores` or
  `salary_benchmarks` table yet — correctly so, per CLAUDE.md's "do not
  create future modules until they are actually needed." The first real
  matching/salary-intelligence work will still **add** new tables, but
  those are purely additive (new tables + foreign keys into the
  structure above), not a rework of the columns or relationships already
  in place — which is the "no major migration" guarantee this design is
  making.

---

## Open questions

Every place CLAUDE.md was silent and a decision had to be assumed to write
this document:

1. **Primary key strategy.** CLAUDE.md never specifies UUID vs. serial
   integer IDs. Assumed `uuid` with `gen_random_uuid()` defaults
   everywhere, to avoid sequential-ID enumeration on a public-facing
   marketplace (e.g. guessing `/jobs/1002`). This also assumes the target
   Postgres version/extension exposes `gen_random_uuid()` — needs
   confirming against the actual Neon Postgres version once we set up the
   database.

2. **`users.role` vocabulary.** CLAUDE.md never enumerates roles. Assumed
   exactly `candidate`, `employer`, `admin` — the third inferred from "Basic
   admin functionality" in the MVP scope.

3. **`candidate_profiles.availability` vocabulary.** CLAUDE.md says
   "Specify timezone and availability" but never defines the values.
   Assumed `full_time` / `part_time` / `contract`. This could equally be
   free text or an hours-per-week integer — needs your call.

4. **Currency representation.** Assumed a plain `char(3)` ISO 4217 code
   with no backing `currencies` table, since CLAUDE.md's normalization
   requirement is scoped explicitly to skills, not currencies.

5. **`jobs.timezone_requirement`.** Not listed anywhere in CLAUDE.md's MVP
   table list or scope, but "job discovery" plus candidate
   timezone/availability strongly implies employers need to express a
   required overlap. Added as a nullable column and flagged here rather
   than added silently — remove if it's actually out of scope for this
   pass.

6. **`candidate_skills.years_experience` and `job_skills.is_required`.**
   Not explicitly requested. Added because the MVP scope says candidates
   "Add skills and experience," which implies some experience value per
   skill, and because a required/nice-to-have distinction on job skills is
   a near-zero-cost addition that materially helps the matching feature
   named in decision #5. You should confirm whether "experience" means
   years-per-skill (assumed here) or something else, like general resume
   text.

7. **`skills.category`.** Not requested. Added as a nullable grouping
   column (e.g. "language" vs "framework") motivated by future matching,
   not by an explicit CLAUDE.md requirement — flag for removal if you'd
   rather keep `skills` to `id` / `slug` / `name` / `is_active` only.

8. **`companies.name` uniqueness.** Left non-unique — two real companies
   can legitimately share a display name across different legal entities
   or countries. Flag if you want it constrained instead.

9. **Deletion policy for `users` / `companies` / `jobs`.** CLAUDE.md states
   no retention or account-deactivation policy. This design uses hard
   `ON DELETE CASCADE` / `RESTRICT` / `SET NULL` throughout and has no
   `deleted_at` or `is_active` flag on `users`, `companies`, or `jobs`
   themselves (only `skills` gets a soft-disable flag). This is the
   largest assumption in the document — if you actually want soft-delete
   / account deactivation anywhere, several `ON DELETE` behaviours above
   would need to change, and it's much cheaper to add that now than after
   real data exists.
