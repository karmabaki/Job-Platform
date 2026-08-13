# Database Design — MVP

Scope: `users`, `candidate_profiles`, `companies`, `countries`, `skills`,
`skill_aliases`, `candidate_skills`, `candidate_languages`,
`candidate_portfolio_items`, `candidate_work_history`,
`candidate_education`, `jobs`, `job_skills`, `applications`,
`conversations`, `messages`.

This is a design document only. No schema code, no migrations, no packages
installed. Types are written in PostgreSQL terms; the Drizzle schema is a
later, separate step.

All primary keys are `uuid` (default `gen_random_uuid()`) unless noted — see
[Open questions #1](#open-questions) for why this needed an assumption.

## Naming rule (non-negotiable)

Never use **"employment"**, **"employee"**, or **"employer contract"** for
the post-hire relationship between a candidate and a company. Use
**"engagement"** and **"contractor"** instead — e.g.
`applications.engagement_type`, not `employment_type`. This is a
legal-risk decision (the platform must not imply an employment
relationship it doesn't actually create), not a style preference, and it
applies to the whole codebase, not just this document. "Employer" as the
name for the company-side user role (`users.role = 'employer'`) is
unaffected — the rule targets how the *post-hire* relationship is
described, not the pre-hire company/recruiter role.

---

## countries

Reference table, seeded separately (see
[Key decision #7](#key-decisions)) — holds the **full** ISO 3166-1
alpha-2 list, not just markets the platform currently operates in.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| code | char(2) | not null | — | ISO 3166-1 alpha-2 |
| name | text | not null | — | display name |
| candidate_allowed | boolean | not null | `false` | market is open to candidates — see [Key decision #7](#key-decisions) |
| employer_allowed | boolean | not null | `false` | market is open to employers — see [Key decision #7](#key-decisions) |

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
| email | text | not null | — | login identity; stored lowercase, normalized before insert/update |
| password_hash | text | not null | — | never returned in API responses |
| role | text | not null | — | `CHECK (role IN ('candidate','employer','admin'))` |
| company_id | uuid | null | — | set only when `role = 'employer'` |
| email_verified_at | timestamptz | null | — | null until the user verifies their email |
| created_at | timestamptz | not null | `now()` | |
| updated_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `company_id` → `companies(id)` **ON DELETE SET NULL** — losing the
    company record shouldn't delete the user account, just detach it
- **Check constraints:**
  - `CHECK (role = 'employer' OR company_id IS NULL)` — a candidate or
    admin user can never carry a `company_id`
- **Unique constraints:** none as a plain column constraint — enforced
  instead by a functional unique index on `lower(email)` (see Indexes),
  since Postgres can't put a table `UNIQUE` constraint directly on an
  expression
- **Indexes:**
  - unique index on `lower(email)` — every login looks up by
    case-normalized email; this is what actually enforces "one account
    per email" regardless of casing
  - index on `company_id` — "list employer users for this company" (admin
    tooling, employer team views)

---

## candidate_profiles

One-to-one with `users` (only for `role = 'candidate'`). Shares its
primary key with `users` instead of carrying its own surrogate id — the
standard "extension table" pattern for a strict 1:1 relationship. This
means `candidate_id` columns elsewhere in this document
(`candidate_skills`, `candidate_languages`, `candidate_portfolio_items`,
`candidate_work_history`, `candidate_education`, `applications`) are
literally `users.id` values, not a separate profile id.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| user_id | uuid | not null | — | primary key; also FK to `users(id)` |
| full_name | text | not null | — | |
| headline | text | null | — | e.g. "Senior Backend Engineer" |
| bio | text | null | — | |
| github_url | text | null | — | |
| country_code | char(2) | not null | — | candidate_country |
| timezone | text | not null | — | IANA tz name, e.g. `Asia/Tehran` |
| availability | text | not null | — | `CHECK (availability IN ('full_time','part_time','contract'))` — see [Open questions #3](#open-questions) |
| salary_expectation_min | integer | null | — | see [Key decision #2](#key-decisions) |
| salary_expectation_max | integer | null | — | |
| salary_currency | char(3) | null | — | ISO 4217, required together with min/max at the app layer |
| salary_period | text | null | — | `CHECK (salary_period IN ('yearly','monthly','hourly'))` |
| total_years_experience | smallint | null | — | overall career length — a different question from `candidate_skills.years_experience` (per-skill); see [Open questions #6](#open-questions). `CHECK (total_years_experience IS NULL OR (total_years_experience BETWEEN 0 AND 60))` |
| profile_completeness | smallint | not null | `0` | `CHECK (profile_completeness BETWEEN 0 AND 100)` — see [Key decision #8](#key-decisions) |
| is_searchable | boolean | not null | `false` | true once `profile_completeness` crosses the threshold — see [Key decision #8](#key-decisions) |
| created_at | timestamptz | not null | `now()` | |
| updated_at | timestamptz | not null | `now()` | |

Note: `portfolio_url` was **removed** in Phase 4.5 — a single link is now
represented as one row in `candidate_portfolio_items` instead (which also
supports multiple items, titles, and descriptions that a bare URL
column couldn't).

- **Primary key:** `user_id`
- **Foreign keys:**
  - `user_id` → `users(id)` **ON DELETE CASCADE** — profile has no meaning
    without its user
  - `country_code` → `countries(code)` **ON DELETE RESTRICT** — a country
    in active use by a profile can't disappear out from under it
- **Check constraints:**
  - `CHECK (salary_expectation_min IS NULL OR salary_expectation_min >= 0)`
    — no negative salary expectations
  - `CHECK (salary_expectation_min IS NULL OR salary_expectation_max IS
    NULL OR salary_expectation_max >= salary_expectation_min)` — max can't
    be below min when both are given
  - `CHECK ((salary_expectation_min IS NULL AND salary_expectation_max IS
    NULL) OR (salary_currency IS NOT NULL AND salary_period IS NOT NULL))`
    — a bare number with no currency or period is meaningless
  - `CHECK (total_years_experience IS NULL OR (total_years_experience
    BETWEEN 0 AND 60))` — sanity bound, not a real-world limit enforcement
  - `CHECK (profile_completeness BETWEEN 0 AND 100)` — it's a percentage
- **Unique constraints:** none beyond the primary key (`user_id` already
  guarantees one-to-one with `users`)
- **Indexes:**
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
| alias | text | not null | — | stored lowercase, normalized before insert |
| created_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `skill_id` → `skills(id)` **ON DELETE CASCADE** — an alias is
    meaningless without its canonical skill
- **Unique constraints:** none as a plain column constraint — enforced
  instead by a functional unique index on `lower(alias)` (see Indexes),
  same reasoning as `users.email`
- **Indexes:**
  - unique index on `lower(alias)` — this table's entire purpose is
    "look up by alias text," case-insensitively; also stops "JS" and "js"
    being registered as two different aliases
  - index on `skill_id` — "list all known variants for this skill" (admin
    UI)

---

## candidate_skills

Join table between candidates and skills.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| candidate_id | uuid | not null | — | references `candidate_profiles.user_id` |
| skill_id | uuid | not null | — | |
| years_experience | smallint | null | — | see [Open questions #6](#open-questions) |
| created_at | timestamptz | not null | `now()` | |

- **Primary key:** composite `(candidate_id, skill_id)` — a candidate lists
  a given skill at most once
- **Foreign keys:**
  - `candidate_id` → `candidate_profiles(user_id)` **ON DELETE CASCADE**
  - `skill_id` → `skills(id)` **ON DELETE RESTRICT** — retire a skill via
    `is_active`, don't delete it out from under existing candidates
- **Unique constraints:** none beyond the composite primary key
- **Indexes:**
  - index on `skill_id` — "which candidates have skill X" — the core
    query any future matching feature runs (the primary key already
    indexes lookups the other direction, by `candidate_id`)

---

## candidate_languages

Join table between candidates and spoken languages.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| candidate_id | uuid | not null | — | references `candidate_profiles.user_id` |
| language_code | char(2) | not null | — | ISO 639-1 |
| proficiency | text | not null | — | `CHECK (proficiency IN ('basic','conversational','professional','fluent','native'))` |

- **Primary key:** composite `(candidate_id, language_code)` — a candidate
  lists a given language at most once
- **Foreign keys:**
  - `candidate_id` → `candidate_profiles(user_id)` **ON DELETE CASCADE**
- **Unique constraints:** none beyond the composite primary key
- **Indexes:** none beyond the primary key — unlike `candidate_skills`,
  this table has no current reverse-lookup use case ("candidates who
  speak X") requested; not added speculatively

---

## candidate_portfolio_items

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | not null | `gen_random_uuid()` | |
| candidate_id | uuid | not null | — | references `candidate_profiles.user_id` |
| title | text | not null | — | |
| description | text | null | — | |
| url | text | null | — | optional — private/NDA'd work has no public link |
| sort_order | smallint | not null | `0` | candidate-controlled display order |
| created_at | timestamptz | not null | `now()` | |
| updated_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `candidate_id` → `candidate_profiles(user_id)` **ON DELETE CASCADE**
- **Unique constraints:** none
- **Indexes:**
  - composite index on `(candidate_id, sort_order)` — loading a
    candidate's portfolio in display order is the only real read query
    this table serves

---

## candidate_work_history

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | not null | `gen_random_uuid()` | |
| candidate_id | uuid | not null | — | references `candidate_profiles.user_id` |
| role_title | text | not null | — | |
| company_name | text | null | — | optional — NDA'd employer |
| description | text | null | — | |
| start_year | smallint | not null | — | `CHECK (start_year BETWEEN 1950 AND 2100)` |
| start_month | smallint | null | — | `CHECK (start_month IS NULL OR start_month BETWEEN 1 AND 12)` |
| end_year | smallint | null | — | |
| end_month | smallint | null | — | `CHECK (end_month IS NULL OR end_month BETWEEN 1 AND 12)` |
| is_current | boolean | not null | `false` | |
| sort_order | smallint | not null | `0` | candidate-controlled display order |
| created_at | timestamptz | not null | `now()` | |
| updated_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `candidate_id` → `candidate_profiles(user_id)` **ON DELETE CASCADE**
- **Check constraints:**
  - `CHECK (start_year BETWEEN 1950 AND 2100)` — sanity bound
  - `CHECK (start_month IS NULL OR start_month BETWEEN 1 AND 12)`
  - `CHECK (end_month IS NULL OR end_month BETWEEN 1 AND 12)`
  - `CHECK (is_current = false OR (end_year IS NULL AND end_month IS
    NULL))` — a current role can't also have an end date
  - `CHECK (end_year IS NULL OR end_year >= start_year)` — end can't
    precede start
  - `CHECK (end_year IS NULL OR end_year > start_year OR end_month IS
    NULL OR start_month IS NULL OR end_month >= start_month)` — within
    the same year, end month can't precede start month (when both are
    known)
- **Unique constraints:** none
- **Indexes:**
  - composite index on `(candidate_id, sort_order)` — same reasoning as
    `candidate_portfolio_items`

---

## candidate_education

Same shape as `candidate_work_history` — the three named-entity columns
are swapped for education-specific ones (`institution_name` / `degree` /
`field_of_study` in place of `role_title` / `company_name`), plus its
own free-text `description` (thesis, honors, coursework — resolved per
[Open questions #10](#open-questions)); dates, `is_current`,
`sort_order`, and all four cross-field date `CHECK`s are identical.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | not null | `gen_random_uuid()` | |
| candidate_id | uuid | not null | — | references `candidate_profiles.user_id` |
| institution_name | text | not null | — | |
| degree | text | null | — | |
| field_of_study | text | null | — | |
| description | text | null | — | thesis, honors, coursework, etc. |
| start_year | smallint | not null | — | `CHECK (start_year BETWEEN 1950 AND 2100)` |
| start_month | smallint | null | — | `CHECK (start_month IS NULL OR start_month BETWEEN 1 AND 12)` |
| end_year | smallint | null | — | |
| end_month | smallint | null | — | `CHECK (end_month IS NULL OR end_month BETWEEN 1 AND 12)` |
| is_current | boolean | not null | `false` | |
| sort_order | smallint | not null | `0` | candidate-controlled display order |
| created_at | timestamptz | not null | `now()` | |
| updated_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `candidate_id` → `candidate_profiles(user_id)` **ON DELETE CASCADE**
- **Check constraints:** identical set to `candidate_work_history`
  (`start_year` range, `start_month`/`end_month` range, `is_current`
  implies no end date, `end_year >= start_year`, same-year month
  ordering)
- **Unique constraints:** none
- **Indexes:**
  - composite index on `(candidate_id, sort_order)` — same reasoning as
    `candidate_portfolio_items`

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
| timezone_anchor | text | null | — | IANA tz name the required overlap is measured against — see [Open questions #5](#open-questions) |
| timezone_overlap_hours | smallint | null | — | minimum required overlap, in hours — see [Open questions #5](#open-questions) |
| published_at | timestamptz | null | — | set when `status` first becomes `'published'` |
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
- **Check constraints:**
  - `CHECK (salary_min IS NULL OR salary_min >= 0)` — no negative salaries
  - `CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_max >=
    salary_min)` — max can't be below min when both are given
  - `CHECK ((salary_min IS NULL AND salary_max IS NULL) OR
    (salary_currency IS NOT NULL AND salary_period IS NOT NULL))` — a bare
    number with no currency or period is meaningless
  - `CHECK (status <> 'published' OR published_at IS NOT NULL)` — a
    published job with a null `published_at` would never appear in the
    feed, since the feed index sorts on `published_at`
- **Unique constraints:** none
- **Indexes:**
  - index on `company_id` — employer dashboard, "jobs for my company"
  - composite index on `(status, published_at DESC)` — the public job
    feed: published jobs, most recently published first (`published_at`
    reflects re-publishing; `created_at` wouldn't)
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
| candidate_id | uuid | not null | — | references `candidate_profiles.user_id` |
| status | text | not null | `'applied'` | `CHECK (status IN ('applied','shortlisted','rejected','hired'))` |
| cover_note | text | null | — | |
| hired_at | timestamptz | null | — | set when the application converts to a hire |
| agreed_rate_amount | integer | null | — | integer only, see [Key decision #2](#key-decisions) |
| agreed_rate_currency | char(3) | null | — | ISO 4217 |
| engagement_type | text | null | — | `CHECK (engagement_type IS NULL OR engagement_type IN ('permanent','fixed_term'))` |
| engagement_months | smallint | null | — | minimum contractor engagement length, in months — `CHECK (engagement_months IS NULL OR engagement_months >= 6)` |
| placement_fee_amount | integer | null | — | stored only, not computed — see [Key decision #6](#key-decisions) |
| created_at | timestamptz | not null | `now()` | |
| updated_at | timestamptz | not null | `now()` | |

Note: `placement_fee_amount` is a **stored** value, not computed in SQL —
the fee formula is a business rule that will live in the backend later
(see [Key decision #6](#key-decisions)).

- **Primary key:** `id`
- **Foreign keys:**
  - `job_id` → `jobs(id)` **ON DELETE CASCADE** — applications are
    meaningless once the job posting is gone
  - `candidate_id` → `candidate_profiles(user_id)` **ON DELETE CASCADE**
- **Check constraints:**
  - `CHECK (agreed_rate_amount IS NULL OR agreed_rate_currency IS NOT
    NULL)` — a rate with no currency is meaningless
  - `CHECK (status <> 'hired' OR hired_at IS NOT NULL)` — same class of
    bug as the `jobs` published/`published_at` pair; hire counts must be
    trustworthy
- **Unique constraints:** `(job_id, candidate_id)` — a candidate can apply
  to a given job only once
- **Indexes:**
  - index on `candidate_id` — candidate's "my applications" dashboard
    (the unique constraint's backing index already covers `job_id` first,
    so this covers the other lookup direction)
  - composite index on `(job_id, status)` — employer's applicant list
    filtered/grouped by pipeline stage

---

## conversations

One thread per application — see [Key decision #6](#key-decisions).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | not null | `gen_random_uuid()` | |
| application_id | uuid | not null | — | |
| created_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `application_id` → `applications(id)` **ON DELETE CASCADE** — a
    conversation has no meaning once the application it's attached to is
    gone
- **Unique constraints:** `application_id` — exactly one thread per
  application
- **Indexes:**
  - unique index on `application_id` — enforces the one-thread-per-
    application rule and is also the lookup used to open a thread from an
    application

---

## messages

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | not null | `gen_random_uuid()` | |
| conversation_id | uuid | not null | — | |
| sender_user_id | uuid | not null | — | |
| body | text | not null | — | |
| created_at | timestamptz | not null | `now()` | |

- **Primary key:** `id`
- **Foreign keys:**
  - `conversation_id` → `conversations(id)` **ON DELETE CASCADE** — a
    message has no meaning once its thread is gone
  - `sender_user_id` → `users(id)` **ON DELETE RESTRICT** — preserves
    message authorship; a user row can't be removed while they have
    message history (inert today since the MVP has no delete endpoints,
    but correct if that ever changes)
- **Unique constraints:** none
- **Indexes:**
  - composite index on `(conversation_id, created_at DESC)` — loading a
    thread's messages, newest first, is the only real read query this
    table serves

---

## Operational notes

### updated_at maintenance

Every `updated_at` column listed above is maintained at the application
layer via Drizzle ORM's `$onUpdate()` column option, which sets
`updated_at = now()` automatically whenever Drizzle performs an `update`
on that row. There is no Postgres trigger doing this. That keeps the
timestamp behavior defined alongside the rest of the schema-as-code
instead of a separate trigger migration, consistent with this project's
"no unnecessary abstraction" rule. The tradeoff: a write that bypasses
Drizzle (a manual `psql` `UPDATE`, a future direct-SQL job) will not
refresh `updated_at` — accepted because the MVP has no write path outside
the NestJS API.

### profile_completeness recalculation

Like `updated_at`, `candidate_profiles.profile_completeness` (and the
`is_searchable` flag derived from it) is maintained at the application
layer, not by a Postgres trigger — same reasoning as `updated_at`
above: one mechanism (Drizzle service code), not two (SQL triggers plus
app code), for the same class of "derived on write" column.

**Recalculated on every write to:** `candidate_profiles` itself, or any
row in `candidate_skills`, `candidate_languages`,
`candidate_portfolio_items`, `candidate_work_history`, or
`candidate_education` for that candidate. See [Key decision
#8](#key-decisions) for the weighting formula and the `is_searchable`
threshold.

### Deletion policy (resolved — see [Open questions](#open-questions))

The MVP has **no soft delete** and exposes **no delete endpoints**
anywhere. Rows disappear only as a side effect of `ON DELETE CASCADE` on
a genuinely dependent row, or are blocked by `ON DELETE RESTRICT` when
something still references them. Entities that need a lifecycle instead
of deletion use a status column already in this schema — a job is retired
by setting `status = 'closed'`, not by deleting the row.

### Authorization requirements not enforceable in SQL

**`candidate_profiles.user_id` references `users(id)` with no database
guarantee that the referenced user's `role` is `'candidate'`.** An
employer or admin row could just as easily get a `candidate_profiles`
row attached to it, and from there go on to apply to jobs. **The backend
MUST verify `role = 'candidate'`** before creating a `candidate_profiles`
row, and again before creating an `applications` row. **Resolved in
Phase 4:** enforced by `RolesGuard` (`@Roles('candidate')`) on
`CandidatesController` and on the applications-creation path — not
something the schema can enforce on its own, but no longer just a
flagged intention.

**`messages.sender_user_id` has no database-level guarantee that the
sender actually belongs to the conversation.** The foreign key only
proves `sender_user_id` is *some* real user — nothing in the schema stops
a candidate from a different application, or an employer from an
unrelated company, from being inserted as the sender on someone else's
thread.

**Before any insert into `messages`, the backend MUST verify** the
sender is either:
- the application's `candidate_id` (via
  `conversations.application_id → applications.candidate_id`), or
- a user whose `company_id` matches the job's `company_id` (via
  `applications.job_id → jobs.company_id`).

**Still an open requirement, deferred to the future chat phase** — the
`conversations`/`messages` tables exist in the schema, but no chat
module or endpoints have been built yet (explicitly out of scope through
Phase 5.5). This is application-layer authorization logic, not a schema
change, but it is a hard prerequisite for `messages` being safe to write
to whenever that phase starts.

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
company). A user belongs to at most one company. Enforced with
`CHECK (role = 'employer' OR company_id IS NULL)`, so a candidate or
admin row can never carry a `company_id` even from an application-layer
bug.

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

### 6. Post-hire fields live on `applications`; no payment/escrow/contract tables

**Choice:** hiring-outcome data (`hired_at`, `agreed_rate_amount`,
`agreed_rate_currency`, `engagement_type`, `engagement_months`,
`placement_fee_amount`) is stored directly on `applications` — the row
that already represents "this candidate, this job." `conversations` /
`messages` give each application a single message thread. No `payment`,
`escrow`, `invoice`, `contract`, or `dispute` tables exist, and none are
planned for this phase. `placement_fee_amount` is a stored number only —
the formula that computes it is a business rule for the backend, not SQL.

**Tradeoff:** this is the cheapest way to record "we hired this person,
here's what was agreed" without building a payments domain the MVP
doesn't need yet. The cost: there's nowhere to record payment status,
invoicing, or dispute history — when any of that becomes real, it's new
tables, not new columns bolted onto `applications`. This is a deliberate
scope boundary, not an oversight.

### 7. `countries` holds the full ISO list; market availability is a data flag, not a schema change

**Choice:** `countries` is seeded with the **complete** ISO 3166-1
alpha-2 list — every country, not just ones the platform currently
operates in. Two booleans, `candidate_allowed` and `employer_allowed`
(both default `false`), control which markets are actually open at the
product layer. This means every `country_code` foreign key
(`candidate_profiles`, `companies`) can always resolve — a candidate or
company from any real country can be referenced without the FK ever
failing with an unexplained "invalid input" error, even before or after
that market is opened.

**Tradeoff:** opening (or closing) a market is a plain `UPDATE
countries SET candidate_allowed = true WHERE code = '...'`, not a
migration and not a deploy — the tradeoff is that "is this country a
live market" now lives in application data rather than in the schema
itself, so anyone reading the schema alone can't tell which markets are
actually active; that answer only comes from querying the table (or the
seed script's market-flag list, which documents the current state in
code review).

### 8. `profile_completeness` weighting and the `is_searchable` threshold

**Choice — the weighting formula.** `profile_completeness` is a 0–100
score, computed as the sum of these independent, boolean checks (each
either fully earned or not — no partial credit):

| Signal | Points | Why this weight |
|---|---|---|
| `headline` is set | 10 | Narrative context, cheap to fill in |
| `bio` is set | 10 | Narrative context, cheap to fill in |
| at least 1 row in `candidate_skills` | 15 | The strongest structured signal for matching |
| at least 1 row in `candidate_languages` | 10 | Useful, but not every role requires it |
| `github_url` is set **or** at least 1 row in `candidate_portfolio_items` | 15 | Concrete evidence of ability — as important as skills |
| at least 1 row in `candidate_work_history` | 15 | Strongest evidence of real-world experience |
| at least 1 row in `candidate_education` | 5 | Weakest signal of the group — a formal-education gate would exclude self-taught candidates who are otherwise fully qualified |
| salary expectation fully set (`min`, `max`, `currency`, `period` all present) | 15 | This platform's core value proposition is salary arbitrage — an employer's primary filter is salary fit, so this is weighted with skills/evidence, not treated as a minor extra |
| `total_years_experience` is set | 5 | Lowest weight — already partly redundant with work history |
| **Total** | **100** | |

Per-row fields (e.g. `candidate_skills.years_experience`, portfolio item
descriptions) are **not** individually scored — only "does at least one
row exist" per table. Scoring every field of every row would reward
padding a list with low-effort entries over actually filling in the
categories that matter; presence-per-category is enough signal for an
MVP.

**Choice — the `is_searchable` threshold is 55.** Against this rubric,
55 is comfortably clearable — e.g. skills + evidence + work history
alone (15+15+15=45) plus one more small category, or headline + bio +
skills + salary (10+10+15+15=50) plus a little more — without needing
every category filled in. This is deliberately **not** the highest
defensible bar: an earlier draft of this document proposed 70, which —
worked out precisely against this same rubric — leaves only 30 points of
slack; the three smallest categories (languages 10 + education 5 +
years-experience 5 = 20) use up most of that on their own, leaving just
10 points of remaining slack — not enough to also skip any of `skills`,
`evidence`, `work history`, or `salary` (each 15 points), and only
enough to skip **one** of `headline`/`bio` (10 points each), not both.
In effect, at 70, skills/evidence/work-history/salary become fully
mandatory and headline/bio become mostly mandatory (at most one may be
missing). In a marketplace that doesn't have supply yet, that throttles
the thing the business needs most: enough searchable candidates for
employers to find anything at all. **55 is a deliberate early-stage
setting, not a permanent judgment about candidate quality** — it should
be raised once supply is healthy enough that being selective no longer
costs the marketplace liquidity.

A freshly-created profile with only the fields required at signup
(`full_name`, `country_code`, `timezone`, `availability`) still scores
close to 0 — those four are always present but none of them are
counted above, since they're mandatory at creation and carry no
*discriminating* signal about completeness.

**Tradeoff:** a low early-stage threshold means `is_searchable`
candidates may have thinner profiles than employers would ideally see —
accepted deliberately, per above. Any fixed threshold is a judgment
call, not derived from data (there's no usage data yet to derive it
from). It's cheap to change later: `is_searchable` is recomputed from
`profile_completeness` on every write, so raising the threshold constant
doesn't require a migration or backfill, only a future write to each
existing row (or a one-time recompute pass) to apply retroactively.

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

5. **Job timezone-fit fields.** Not listed anywhere in CLAUDE.md's MVP
   table list or scope; "job discovery" plus candidate
   timezone/availability strongly implied employers need to express a
   required overlap, so a field was added and flagged here rather than
   silently. **Existence resolved** in Phase 2 Part B:
   `jobs.timezone_anchor` (IANA tz name) + `jobs.timezone_overlap_hours`
   (minimum required overlap, in hours). Still open: the schema stores
   these two values but doesn't encode how overlap is computed or
   enforced (e.g. compared against which of the candidate's fields,
   whether it's a hard filter or a ranking signal) — that's
   matching/query logic for a later phase, not a schema question.

6. **`candidate_skills.years_experience` and `job_skills.is_required`.**
   Not explicitly requested. Added because the MVP scope says candidates
   "Add skills and experience," which implies some experience value per
   skill, and because a required/nice-to-have distinction on job skills is
   a near-zero-cost addition that materially helps the matching feature
   named in decision #5. **Resolved in Phase 4.5:** confirmed as
   per-skill years, and kept alongside the new
   `candidate_profiles.total_years_experience` — the two answer different
   questions (career-wide total vs. depth in one specific skill) and
   both are needed, per your explicit instruction.

7. **`skills.category`.** Not requested. Added as a nullable grouping
   column (e.g. "language" vs "framework") motivated by future matching,
   not by an explicit CLAUDE.md requirement — flag for removal if you'd
   rather keep `skills` to `id` / `slug` / `name` / `is_active` only.

8. **`companies.name` uniqueness.** Left non-unique — two real companies
   can legitimately share a display name across different legal entities
   or countries. Flag if you want it constrained instead.

9. **Deletion policy for `users` / `companies` / `jobs`.** **Resolved in
   Phase 2 Part B:** no soft delete, no delete endpoints anywhere in the
   MVP — see [Operational notes → Deletion policy](#operational-notes) for
   the resolution. (Originally: CLAUDE.md states no retention or
   account-deactivation policy, so this was the largest open assumption in
   the document — hard `ON DELETE CASCADE` / `RESTRICT` / `SET NULL` were
   used throughout with no `deleted_at` flag anywhere except
   `skills.is_active`.)

10. **`candidate_education`'s `description` column.** **Resolved:**
    confirmed intended, not omitted — a `description text null` column
    was added (thesis, honors, coursework), alongside
    `institution_name` / `degree` / `field_of_study`.

11. **`profile_completeness` threshold (70) is a judgment call, not
    data-derived.** See [Key decision #8](#key-decisions)'s tradeoff —
    there's no usage data yet to calibrate against. Cheap to change
    later since it's just a constant the recalculation reads, not a
    schema value.
