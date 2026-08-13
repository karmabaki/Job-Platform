import path from 'node:path';
import process from 'node:process';

process.loadEnvFile(path.resolve(__dirname, '../../.env'));

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql, inArray, eq, count } from 'drizzle-orm';
import { getNames } from 'i18n-iso-countries';
import { countries } from './countries';
import { skills, skillAliases } from './skills';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in apps/api/.env');
}

const client = neon(process.env.DATABASE_URL);
const db = drizzle(client);

async function seedCountries() {
  const names = getNames('en');
  const rows = Object.entries(names).map(([code, name]) => ({ code, name }));

  // Upsert: on conflict, only touch `name`. This never resets
  // candidate_allowed/employer_allowed on rows that already exist —
  // that's what makes re-running this script safe.
  await db
    .insert(countries)
    .values(rows)
    .onConflictDoUpdate({
      target: countries.code,
      set: { name: sql`excluded.name` },
    });

  return rows.length;
}

// --- Initial market flags ---
// Supply markets are selected for developer salaries broadly under
// ~$1500/month; demand markets for broadly above ~$3000/month.
// Comprehensively sanctioned jurisdictions (CU IR KP SY) and
// targeted-sanction jurisdictions (RU BY VE MM NI) are deliberately
// excluded from both lists.
const CANDIDATE_ALLOWED_CODES = [
  'IN',
  'PK',
  'BD',
  'LK',
  'NP',
  'VN',
  'PH',
  'ID',
  'KH',
  'EG',
  'MA',
  'TN',
  'JO',
  'DZ',
  'NG',
  'KE',
  'GH',
  'RW',
  'UG',
  'TZ',
  'RS',
  'MK',
  'AL',
  'BA',
  'ME',
  'MD',
  'GE',
  'AM',
  'AZ',
  'UZ',
  'KZ',
  'KG',
  'AR',
  'CO',
  'PE',
  'BO',
  'EC',
  'PY',
  'GT',
  'HN',
  'SV',
  'DO',
  'TR',
];

const EMPLOYER_ALLOWED_CODES = [
  'US',
  'CA',
  'GB',
  'IE',
  'DE',
  'NL',
  'FR',
  'BE',
  'LU',
  'AT',
  'CH',
  'DK',
  'SE',
  'NO',
  'FI',
  'IS',
  'ES',
  'IT',
  'PT',
  'PL',
  'CZ',
  'EE',
  'LT',
  'SI',
  'SK',
  'HU',
  'AU',
  'NZ',
  'SG',
  'JP',
  'KR',
  'HK',
  'IL',
  'AE',
  'SA',
  'QA',
  'KW',
  'BH',
  'OM',
];

async function setInitialMarketFlags() {
  await db
    .update(countries)
    .set({ candidateAllowed: true })
    .where(inArray(countries.code, CANDIDATE_ALLOWED_CODES));
  await db
    .update(countries)
    .set({ employerAllowed: true })
    .where(inArray(countries.code, EMPLOYER_ALLOWED_CODES));
}

// --- Skills ---
// ~100 common software-engineering skills. slug is the stable,
// admin-curated identity (see docs/database-design.md Key decision
// #1); name is what's displayed. Re-running only ever touches
// name/category on conflict — is_active is never written here, so an
// admin who deactivates a skill won't have it silently reactivated by
// a re-seed.
const SKILLS: { slug: string; name: string; category: string }[] = [
  // languages
  { slug: 'javascript', name: 'JavaScript', category: 'language' },
  { slug: 'typescript', name: 'TypeScript', category: 'language' },
  { slug: 'python', name: 'Python', category: 'language' },
  { slug: 'java', name: 'Java', category: 'language' },
  { slug: 'csharp', name: 'C#', category: 'language' },
  { slug: 'go', name: 'Go', category: 'language' },
  { slug: 'rust', name: 'Rust', category: 'language' },
  { slug: 'ruby', name: 'Ruby', category: 'language' },
  { slug: 'php', name: 'PHP', category: 'language' },
  { slug: 'swift', name: 'Swift', category: 'language' },
  { slug: 'kotlin', name: 'Kotlin', category: 'language' },
  { slug: 'c', name: 'C', category: 'language' },
  { slug: 'cpp', name: 'C++', category: 'language' },
  { slug: 'scala', name: 'Scala', category: 'language' },
  { slug: 'elixir', name: 'Elixir', category: 'language' },
  { slug: 'haskell', name: 'Haskell', category: 'language' },
  { slug: 'dart', name: 'Dart', category: 'language' },
  { slug: 'r', name: 'R', category: 'language' },
  { slug: 'perl', name: 'Perl', category: 'language' },
  { slug: 'lua', name: 'Lua', category: 'language' },

  // frameworks & libraries
  { slug: 'nodejs', name: 'Node.js', category: 'framework' },
  { slug: 'react', name: 'React', category: 'framework' },
  { slug: 'vue', name: 'Vue.js', category: 'framework' },
  { slug: 'angular', name: 'Angular', category: 'framework' },
  { slug: 'svelte', name: 'Svelte', category: 'framework' },
  { slug: 'nextjs', name: 'Next.js', category: 'framework' },
  { slug: 'nuxt', name: 'Nuxt.js', category: 'framework' },
  { slug: 'express', name: 'Express', category: 'framework' },
  { slug: 'nestjs', name: 'NestJS', category: 'framework' },
  { slug: 'django', name: 'Django', category: 'framework' },
  { slug: 'flask', name: 'Flask', category: 'framework' },
  { slug: 'fastapi', name: 'FastAPI', category: 'framework' },
  { slug: 'spring', name: 'Spring', category: 'framework' },
  { slug: 'springboot', name: 'Spring Boot', category: 'framework' },
  { slug: 'rails', name: 'Ruby on Rails', category: 'framework' },
  { slug: 'laravel', name: 'Laravel', category: 'framework' },
  { slug: 'dotnet', name: '.NET', category: 'framework' },
  { slug: 'reactnative', name: 'React Native', category: 'framework' },
  { slug: 'flutter', name: 'Flutter', category: 'framework' },
  { slug: 'redux', name: 'Redux', category: 'framework' },
  { slug: 'graphql', name: 'GraphQL', category: 'framework' },
  { slug: 'tailwindcss', name: 'Tailwind CSS', category: 'framework' },
  { slug: 'bootstrap', name: 'Bootstrap', category: 'framework' },
  { slug: 'jquery', name: 'jQuery', category: 'framework' },
  { slug: 'ember', name: 'Ember.js', category: 'framework' },

  // databases
  { slug: 'postgresql', name: 'PostgreSQL', category: 'database' },
  { slug: 'mysql', name: 'MySQL', category: 'database' },
  { slug: 'sqlite', name: 'SQLite', category: 'database' },
  { slug: 'mongodb', name: 'MongoDB', category: 'database' },
  { slug: 'redis', name: 'Redis', category: 'database' },
  { slug: 'elasticsearch', name: 'Elasticsearch', category: 'database' },
  { slug: 'cassandra', name: 'Cassandra', category: 'database' },
  { slug: 'dynamodb', name: 'DynamoDB', category: 'database' },
  { slug: 'mariadb', name: 'MariaDB', category: 'database' },
  { slug: 'oracle', name: 'Oracle Database', category: 'database' },
  { slug: 'sqlserver', name: 'Microsoft SQL Server', category: 'database' },
  { slug: 'neo4j', name: 'Neo4j', category: 'database' },
  { slug: 'couchdb', name: 'CouchDB', category: 'database' },
  { slug: 'firebase', name: 'Firebase', category: 'database' },
  { slug: 'supabase', name: 'Supabase', category: 'database' },

  // cloud & infrastructure
  { slug: 'aws', name: 'Amazon Web Services', category: 'cloud' },
  { slug: 'azure', name: 'Microsoft Azure', category: 'cloud' },
  { slug: 'gcp', name: 'Google Cloud Platform', category: 'cloud' },
  { slug: 'docker', name: 'Docker', category: 'cloud' },
  { slug: 'kubernetes', name: 'Kubernetes', category: 'cloud' },
  { slug: 'terraform', name: 'Terraform', category: 'cloud' },
  { slug: 'ansible', name: 'Ansible', category: 'cloud' },
  { slug: 'jenkins', name: 'Jenkins', category: 'cloud' },
  { slug: 'githubactions', name: 'GitHub Actions', category: 'cloud' },
  { slug: 'gitlabci', name: 'GitLab CI', category: 'cloud' },
  { slug: 'circleci', name: 'CircleCI', category: 'cloud' },
  { slug: 'cloudflare', name: 'Cloudflare', category: 'cloud' },
  { slug: 'vercel', name: 'Vercel', category: 'cloud' },
  { slug: 'netlify', name: 'Netlify', category: 'cloud' },
  { slug: 'heroku', name: 'Heroku', category: 'cloud' },

  // tooling
  { slug: 'git', name: 'Git', category: 'tool' },
  { slug: 'webpack', name: 'Webpack', category: 'tool' },
  { slug: 'vite', name: 'Vite', category: 'tool' },
  { slug: 'babel', name: 'Babel', category: 'tool' },
  { slug: 'eslint', name: 'ESLint', category: 'tool' },
  { slug: 'prettier', name: 'Prettier', category: 'tool' },
  { slug: 'jest', name: 'Jest', category: 'tool' },
  { slug: 'mocha', name: 'Mocha', category: 'tool' },
  { slug: 'cypress', name: 'Cypress', category: 'tool' },
  { slug: 'playwright', name: 'Playwright', category: 'tool' },
  { slug: 'selenium', name: 'Selenium', category: 'tool' },
  { slug: 'npm', name: 'npm', category: 'tool' },
  { slug: 'yarn', name: 'Yarn', category: 'tool' },
  { slug: 'pnpm', name: 'pnpm', category: 'tool' },
  { slug: 'rest', name: 'REST', category: 'tool' },
  { slug: 'grpc', name: 'gRPC', category: 'tool' },
  { slug: 'rabbitmq', name: 'RabbitMQ', category: 'tool' },
  { slug: 'kafka', name: 'Apache Kafka', category: 'tool' },
  { slug: 'nginx', name: 'Nginx', category: 'tool' },
  { slug: 'linux', name: 'Linux', category: 'tool' },
  { slug: 'bash', name: 'Bash', category: 'tool' },
  { slug: 'figma', name: 'Figma', category: 'tool' },
  { slug: 'jira', name: 'Jira', category: 'tool' },
  { slug: 'sentry', name: 'Sentry', category: 'tool' },
  { slug: 'postman', name: 'Postman', category: 'tool' },

  // CMS / no-code / marketing / design / analytics — Phase 4.5, so the
  // vocabulary is usable beyond backend engineering.
  { slug: 'wordpress', name: 'WordPress', category: 'cms' },
  { slug: 'woocommerce', name: 'WooCommerce', category: 'cms' },
  { slug: 'shopify', name: 'Shopify', category: 'cms' },
  { slug: 'webflow', name: 'Webflow', category: 'cms' },
  { slug: 'elementor', name: 'Elementor', category: 'cms' },
  { slug: 'drupal', name: 'Drupal', category: 'cms' },
  { slug: 'magento', name: 'Magento', category: 'cms' },
  { slug: 'wix', name: 'Wix', category: 'cms' },
  { slug: 'squarespace', name: 'Squarespace', category: 'cms' },
  { slug: 'hubspot', name: 'HubSpot', category: 'marketing' },
  { slug: 'salesforce', name: 'Salesforce', category: 'marketing' },
  { slug: 'seo', name: 'SEO', category: 'marketing' },
  { slug: 'google-analytics', name: 'Google Analytics', category: 'marketing' },
  { slug: 'photoshop', name: 'Photoshop', category: 'design' },
  { slug: 'illustrator', name: 'Illustrator', category: 'design' },
  { slug: 'excel', name: 'Excel', category: 'analytics' },
  { slug: 'power-bi', name: 'Power BI', category: 'analytics' },
  { slug: 'tableau', name: 'Tableau', category: 'analytics' },
];

// Obvious free-text variants a candidate/employer might type, mapped
// to the canonical skill slug above (see docs/database-design.md Key
// decision #1 for why aliases exist instead of free-text skills).
const SKILL_ALIASES: { alias: string; slug: string }[] = [
  { alias: 'js', slug: 'javascript' },
  { alias: 'ts', slug: 'typescript' },
  { alias: 'py', slug: 'python' },
  { alias: 'golang', slug: 'go' },
  { alias: 'reactjs', slug: 'react' },
  { alias: 'vuejs', slug: 'vue' },
  { alias: 'next', slug: 'nextjs' },
  { alias: 'node', slug: 'nodejs' },
  { alias: 'postgres', slug: 'postgresql' },
  { alias: 'psql', slug: 'postgresql' },
  { alias: 'mongo', slug: 'mongodb' },
  { alias: 'k8s', slug: 'kubernetes' },
  { alias: 'tailwind', slug: 'tailwindcss' },
  { alias: 'react-native', slug: 'reactnative' },
  { alias: '.net', slug: 'dotnet' },
  { alias: 'c#', slug: 'csharp' },
  { alias: 'c++', slug: 'cpp' },
  { alias: 'mssql', slug: 'sqlserver' },
  { alias: 'ror', slug: 'rails' },
  { alias: 'google-cloud', slug: 'gcp' },
];

async function seedSkills(): Promise<number> {
  // Upsert: on conflict, only touch name/category — never is_active,
  // for the exact same reason as countries' name-only upsert.
  await db
    .insert(skills)
    .values(SKILLS)
    .onConflictDoUpdate({
      target: skills.slug,
      set: { name: sql`excluded.name`, category: sql`excluded.category` },
    });
  return SKILLS.length;
}

async function seedSkillAliases(): Promise<number> {
  const rows = await db
    .select({ id: skills.id, slug: skills.slug })
    .from(skills);
  const slugToId = new Map(rows.map((r) => [r.slug, r.id]));

  // Drizzle's onConflictDoNothing/onConflictDoUpdate can't target an
  // expression-based unique index (only a plain column) — confirmed
  // by testing directly against this DB, it throws internally. The
  // unique index here is on lower(alias), not alias, so raw SQL is
  // used for the upsert instead.
  for (const { alias, slug } of SKILL_ALIASES) {
    const skillId = slugToId.get(slug);
    if (!skillId) {
      throw new Error(
        `Alias "${alias}" points to unknown skill slug "${slug}"`,
      );
    }
    await db.execute(
      sql`INSERT INTO skill_aliases (alias, skill_id) VALUES (${alias}, ${skillId}) ON CONFLICT (lower(alias)) DO NOTHING`,
    );
  }
  return SKILL_ALIASES.length;
}

async function main() {
  const seededCount = await seedCountries();
  await setInitialMarketFlags();
  await seedSkills();
  await seedSkillAliases();

  const [{ total }] = await db.select({ total: count() }).from(countries);
  const [{ candidateAllowedCount }] = await db
    .select({ candidateAllowedCount: count() })
    .from(countries)
    .where(eq(countries.candidateAllowed, true));
  const [{ employerAllowedCount }] = await db
    .select({ employerAllowedCount: count() })
    .from(countries)
    .where(eq(countries.employerAllowed, true));
  const [{ skillsTotal }] = await db
    .select({ skillsTotal: count() })
    .from(skills);
  const [{ skillAliasesTotal }] = await db
    .select({ skillAliasesTotal: count() })
    .from(skillAliases);

  console.log(`Upserted ${seededCount} country rows.`);
  console.log(`Total countries: ${total}`);
  console.log(`candidate_allowed = true: ${candidateAllowedCount}`);
  console.log(`employer_allowed = true: ${employerAllowedCount}`);
  console.log(`Total skills: ${skillsTotal}`);
  console.log(`Total skill_aliases: ${skillAliasesTotal}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
