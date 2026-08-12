# Global Remote Talent Marketplace

## Project

We are building a global remote talent marketplace that connects skilled professionals from lower-wage countries with companies in the US and Europe.

The platform helps:

Candidates:
- Find international remote jobs
- Access salaries higher than their local market
- Create professional profiles
- Add skills and experience
- Add GitHub and portfolio links
- Set salary expectations
- Specify timezone and availability
- Apply to jobs

Employers:
- Find international remote talent
- Post remote jobs
- Search candidates
- Review applications
- Shortlist candidates
- Hire candidates

Future capabilities:
- Skill-based job/candidate matching
- Salary recommendation
- Salary intelligence
- Notifications
- Advanced search
- Analytics

## MVP Scope

The MVP includes:

- Authentication
- Candidate profiles
- Employer/company profiles
- Skills
- Job postings
- Job search
- Applications
- Candidate dashboard
- Employer dashboard
- Basic admin functionality

The MVP does NOT include:

- AI interviews
- English tests
- Technical tests
- Payroll
- EOR
- Mobile applications
- Microservices
- Advanced AI matching

Do not implement excluded features unless explicitly requested.

## Technology Stack

Frontend:
- Next.js
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui

Backend:
- NestJS
- TypeScript
- REST API

Database:
- PostgreSQL
- Neon
- Drizzle ORM

Architecture:
- Monorepo
- npm workspaces
- Separate Next.js frontend and NestJS backend
- Modular monolith backend

## Repository Structure

apps/web
- Next.js frontend

apps/api
- NestJS backend

packages/
- Shared packages only when genuinely necessary

docs/
- Architecture documentation
- Database documentation
- Technical decisions

## Architecture Rules

- Keep the system simple and appropriate for an MVP.
- Prefer a modular monolith.
- Do not introduce microservices.
- Do not introduce unnecessary abstractions.
- Do not add dependencies unless there is a clear reason.
- Keep frontend and backend responsibilities separate.
- Business logic belongs in the backend.
- The frontend should not directly access the database.
- Use REST APIs between frontend and backend.

## Database Rules

Use PostgreSQL with Drizzle ORM.

Skills must be normalized.

Use:

skills
candidate_skills
job_skills

Do not store skills as PostgreSQL arrays unless explicitly approved.

Design the database so future skill-based matching and salary intelligence can be implemented without a major migration.

Important salary fields should support:

- minimum salary
- maximum salary
- currency
- candidate country
- employer country

Use foreign keys and appropriate indexes.

Do not create database tables without first considering their relationships and future usage.

## Backend Rules

Organize NestJS by domain modules.

Expected modules include:

- auth
- users
- candidates
- employers
- jobs
- applications
- skills

Future modules may include:

- matching
- salary
- notifications
- admin

Do not create future modules until they are actually needed.

Modules should have clear boundaries.

Do not access another module's internal implementation directly.

Use DTOs for API input.

Validate incoming data.

Never trust client-provided data.

Keep authorization on the backend.

## API Rules

Use REST.

Use predictable resource-oriented routes.

Examples:

POST /auth/register
POST /auth/login
GET /candidates/me
PATCH /candidates/me
GET /jobs
POST /jobs
GET /jobs/:id
POST /jobs/:id/applications
GET /jobs/:id/applications

Use appropriate HTTP status codes.

Return consistent error responses.

## Security Rules

Never store plaintext passwords.

Passwords must be securely hashed.

Authentication must use secure httpOnly cookies or another secure session mechanism.

Validate and sanitize input.

Never expose passwords, password hashes, secrets, tokens, or private data in API responses or logs.

Use authorization guards for protected resources.

Never trust role information sent by the frontend.

## Frontend Rules

Use Next.js App Router.

Prefer Server Components.

Use Client Components only when interactivity requires them.

Use shadcn/ui and Tailwind for UI.

Avoid unnecessary client-side state.

Do not duplicate backend business logic in the frontend.

Keep API communication centralized and consistent.

## Code Quality

Prefer readable and maintainable code over clever code.

Use clear naming.

Avoid unnecessary comments.

Comments should explain WHY, not obvious WHAT.

Keep functions and components reasonably small.

Do not duplicate logic unnecessarily.

Do not refactor unrelated code while implementing a feature.

## Development Workflow

Always work in small, testable increments.

Before implementing a significant feature:

1. Explain the plan.
2. Identify affected files/modules.
3. Identify database changes.
4. Identify API changes.
5. Wait for approval when the change is architectural or high-risk.

After implementation:

1. Run relevant tests.
2. Run type checking.
3. Run linting when configured.
4. Report what changed.
5. Report how to test it.
6. Report any known limitations.

Never silently make major architectural decisions.

Never implement the entire product in one step.

## Git

Keep commits focused.

Do not mix unrelated changes in one commit.

Do not rewrite Git history unless explicitly requested.

Do not force push.

Before committing, review the changes.

## Important Agent Behavior

You are an AI coding agent working with a developer who is learning the technology.

When making a non-trivial decision, briefly explain the reasoning.

Do not hide important implementation details.

If requirements are ambiguous, ask before making a major assumption.

If you discover a security, architectural, or data-integrity problem, explain it before proceeding.

Do not modify unrelated files.

Do not install packages without explaining why they are needed.

Do not proceed to the next development phase unless explicitly requested.

## Current Development Phase

We are currently in:

Phase 1 — Project Scaffolding

Only work on the current phase unless explicitly instructed otherwise.

Do not implement authentication, database entities, candidate features, employer features, jobs, applications, matching, or salary intelligence during the scaffolding phase.
