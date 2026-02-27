---
name: skill-creator
description: Create, improve, and test skills for the z-schema JSON Schema validator library. Use this skill whenever the user wants to create a new skill from scratch, turn a workflow into a reusable skill, update or refine an existing skill, write test cases for a skill, or organize reference material for a skill. Also use when someone mentions "skill", "SKILL.md", or wants to document a z-schema workflow for reuse by humans or AI agents.
---

# Skill Creator for z-schema

Create skills that help people and AI agents accomplish goals with z-schema — a JSON Schema validator supporting draft-04 through draft-2020-12.

Skills live in `skills/<skill-name>/` and teach Claude how to perform z-schema tasks reliably: validating data, writing schemas, handling errors, using custom formats, contributing to the codebase, and more.

## Communicating with the user

Match your communication style to the user's technical level. Most z-schema users are developers, but skill creation itself may be new to them. Briefly explain skill-specific concepts (frontmatter, progressive disclosure, trigger descriptions) when first introduced. Don't assume everyone knows what YAML frontmatter is — one sentence of explanation is enough.

Keep things conversational and practical. Avoid heavy jargon unless the user is clearly comfortable with it.

---

## Creating a skill

### Step 1: Capture intent

Understand what the user wants the skill to accomplish. The conversation may already contain a workflow to capture — if so, extract what you can from it before asking questions.

Determine:

1. **What should this skill enable?** (e.g., "validate API responses", "migrate schemas from draft-04 to draft-2020-12", "set up z-schema in a new project")
2. **Who is the audience?** Library consumers using z-schema as a dependency, or contributors working on z-schema's source code?
3. **When should this skill trigger?** What phrases or contexts should activate it?
4. **What's the expected output?** Code snippets, configuration, step-by-step instructions, file changes?
5. **Does the skill need test cases?** Skills with deterministic outputs (code generation, schema transforms, error handling patterns) benefit from tests. Skills with subjective outputs (architecture advice, code review style) usually don't.

### Step 2: Interview and research

Ask about edge cases, input variety, and success criteria. Probe for specifics:

- Which JSON Schema drafts does the skill need to cover? All of them, or specific ones?
- Does it involve z-schema options, formats, remote references, error handling?
- Are there existing docs in `docs/` that cover this territory? Check before reinventing.
- Is there an existing skill in `skills/` that overlaps? Review it to avoid duplication and maintain consistency.

Read the relevant z-schema documentation to ground the skill in accurate, current information:

- [docs/architecture.md](docs/architecture.md) — module structure and validation pipeline
- [docs/conventions.md](docs/conventions.md) — code style, naming, imports
- [docs/testing.md](docs/testing.md) — test framework, file naming, patterns
- [docs/contributing.md](docs/contributing.md) — PR workflow, adding features/errors/formats
- [docs/usage.md](docs/usage.md) — library API, validation modes, options
- [docs/features.md](docs/features.md) — feature catalog with examples
- [docs/options.md](docs/options.md) — full options reference

Study the existing `skills/validating-json-schema/SKILL.md` as a reference for tone, structure, and level of detail.

### Step 3: Write the SKILL.md

See [references/skill-structure.md](references/skill-structure.md) for the full structural guide, z-schema conventions, and examples.

**Core principles:**

1. **Start with frontmatter** — `name` and `description` are required. The description is the primary trigger mechanism — make it specific and slightly "pushy" to ensure the skill activates when relevant.

2. **Keep SKILL.md under 500 lines.** Move detailed reference material (option tables, error code lists, schema examples) into `references/` files. Point to them clearly from the main SKILL.md with guidance on when to read each one.

3. **Use imperative instructions.** Write "Create a validator with `ZSchema.create()`" not "You should create a validator...".

4. **Explain the why.** Instead of rigid MUST/NEVER rules, explain reasoning. Today's LLMs respond better to understanding motivation than to heavy-handed directives.

5. **Include working code examples.** z-schema skills are most useful when they contain copy-paste-ready TypeScript snippets. Always use `ZSchema.create()` (never `new ZSchema()`), always use the correct import style, and specify which draft the example targets if it matters.

6. **Ground in z-schema reality.** Every API call, option name, error code, and type name in the skill must be accurate. Cross-reference against `src/index.ts` exports, `docs/options.md`, and `src/errors.ts` to verify.

### Step 4: Organize reference files

If the skill needs detailed supplementary material, add files under `<skill-name>/references/`:

```
skill-name/
├── SKILL.md              # Main instructions (<500 lines)
└── references/           # Detailed reference material
    ├── topic-a.md        # Loaded on demand
    └── topic-b.md        # Loaded on demand
```

Good candidates for reference files:

- Full option tables (see `skills/validating-json-schema/references/options.md`)
- Complete error code listings (see `skills/validating-json-schema/references/error-codes.md`)
- Draft-specific migration guides
- Large schema examples
- Step-by-step tutorials for complex workflows

Include a table of contents in reference files over 150 lines.

### Step 5: Test the skill

For skills with verifiable outputs, create 2–3 realistic test prompts — things a real user would say. Share them with the user for confirmation before running them.

**Test prompt examples for a z-schema skill:**

- "I have user registration data coming from a form and I need to validate it has the right fields and types before saving to the database"
- "My schema uses `$ref` to reference a shared address definition and validation is failing with an unresolvable reference error"
- "I want to validate that dates in my API payload match ISO 8601 format"

**Running tests:**

Execute each test prompt yourself, following the skill's instructions to complete the task. Verify:

- Code examples compile and work with the current z-schema API
- Error codes and option names are accurate
- The skill covers the user's scenario without gaps
- Instructions are unambiguous — a developer unfamiliar with z-schema could follow them

Save test results for the user to review. Organize by test case:

```
<skill-name>-workspace/
└── iteration-1/
    ├── test-1/
    │   └── output/       # Generated code, schemas, etc.
    ├── test-2/
    │   └── output/
    └── notes.md          # What worked, what didn't
```

### Step 6: Iterate

After reviewing test results with the user:

1. **Generalize from feedback.** Don't overfit to test cases. If a user says "the error handling example doesn't show nested errors from `oneOf`", the fix isn't just adding that one example — it's ensuring the error handling section covers combiner keywords comprehensively.

2. **Keep it lean.** Remove instructions that aren't pulling their weight. If test runs show the skill causing unnecessary steps, trim.

3. **Explain the why.** If you find yourself writing "ALWAYS do X", reframe: explain why X matters so the model (or human) understands the reasoning.

4. **Look for repeated patterns.** If every test case required the same boilerplate setup, the skill should include that setup as a template.

5. **Re-verify accuracy.** After changes, re-check API names, option defaults, error codes, and types against the source code.

Rerun tests after changes. Repeat until the user is satisfied or feedback is all positive.

---

## Improving an existing skill

When the user wants to improve a skill that already exists:

1. **Read the current skill thoroughly** — SKILL.md and all reference files.
2. **Understand the complaint** — Is it inaccurate? Incomplete? Poorly triggered? Hard to follow?
3. **Check against current source** — z-schema's API may have changed since the skill was written. Verify all code examples, option names, error codes, and types against `src/`.
4. **Apply the same iteration loop** — make changes, test, review, repeat.

### Common improvement tasks

- **Skill doesn't trigger reliably:** Rewrite the `description` in frontmatter. Make it more specific about when to activate. Include synonyms and related phrases.
- **Code examples are wrong:** Cross-reference against `src/index.ts` exports and `docs/usage.md`. Ensure `ZSchema.create()` is used, imports are correct, and the draft version matches the example.
- **Missing coverage:** Check what the user is asking about against what the skill covers. Add sections or reference files as needed.
- **Too long:** Extract detailed material into `references/` files. Keep SKILL.md focused on the most common workflows.
- **Outdated after z-schema changes:** Read the CHANGELOG.md and recent commits. Update affected sections.

---

## z-schema-specific guidance

Every skill for this repository should respect these constraints:

### API accuracy

- **Factory pattern:** Always `ZSchema.create(options?)` — never `new ZSchema()`. This returns typed variants based on options (`ZSchema`, `ZSchemaSafe`, `ZSchemaAsync`, `ZSchemaAsyncSafe`).
- **Default draft:** `draft2020-12`. Always specify the draft explicitly in examples if it matters.
- **Imports:** Use `import ZSchema from 'z-schema'` (default) or `import { ZSchema } from 'z-schema'` (named). Use `import type { ... }` for type-only imports.
- **Error shape:** `ValidateError` has `.details` (not `.errors`) — an array of `SchemaErrorDetail` with `message`, `code`, `params`, `path`, `keyword`, `inner`.

### Validation modes

Skills should demonstrate the mode appropriate to the use case:

- **Sync throw** (default): `validator.validate(data, schema)` — throws `ValidateError`
- **Safe**: `validator.validateSafe(data, schema)` — returns `{ valid, err? }`
- **Async**: requires `{ async: true }` — for async format validators
- **Async safe**: `{ async: true, safe: true }` — returns `Promise<{ valid, err? }>`

### Draft differences

If a skill involves draft-specific features, be explicit about which drafts support them:

- `prefixItems` — draft-2020-12 only (replaces array-form `items`)
- `$dynamicRef`/`$dynamicAnchor` — draft-2020-12 only
- `$recursiveRef`/`$recursiveAnchor` — draft-2019-09 only
- `unevaluatedProperties`/`unevaluatedItems` — draft-2019-09 and draft-2020-12
- `if`/`then`/`else` — draft-07+
- `$id`, `const`, `contains` — draft-06+

### Code conventions for contributor-facing skills

Skills targeting z-schema contributors (not just consumers) must follow the codebase conventions:

- TypeScript with `strict: true`, ESM with `.js` import extensions in `src/`
- `import type` for type-only imports
- Tests in `test/spec/` with `.spec.ts` / `.node-spec.ts` / `.browser-spec.ts` suffixes
- Exports through `src/index.ts`
- Error codes in `UPPER_SNAKE_CASE` in `src/errors.ts`

See [docs/conventions.md](docs/conventions.md) and [docs/contributing.md](docs/contributing.md) for the full rules.

### Existing documentation

Before writing new reference material, check if `docs/` already covers it:

- `docs/usage.md` — full library API guide
- `docs/options.md` — every option with description and default
- `docs/features.md` — feature catalog with code examples
- `docs/architecture.md` — module structure and validation pipeline
- `docs/testing.md` — test framework and patterns
- `docs/contributing.md` — PR workflow and code change guides

Point to existing docs rather than duplicating them. Only create skill-specific reference files when the skill needs a different angle or aggregation of information.

---

## Skill description optimization

The `description` field in SKILL.md frontmatter determines whether the skill gets activated. After creating or improving a skill, review the description for triggering accuracy.

**Good descriptions:**

- State what the skill does AND when to use it
- Include synonyms and related phrases users might say
- Are slightly "pushy" — lean toward triggering when there's any doubt
- Mention specific z-schema concepts the skill covers

**Example — weak:**

```yaml
description: How to validate JSON data with z-schema.
```

**Example — strong:**

```yaml
description: Validates JSON data against JSON Schema using z-schema. Use when the user needs to validate JSON, define schemas, handle validation errors, use custom formats, or work with JSON Schema drafts 04 through 2020-12. Covers sync/async modes, safe error handling, schema compilation, remote references, and TypeScript types.
```

**Tuning the description:**

1. List 5–10 realistic prompts that should trigger the skill
2. List 5–10 similar prompts that should NOT trigger it
3. Check: does the description clearly include concepts from the should-trigger list while being specific enough to exclude the should-not-trigger list?
4. Revise and re-check

---

## Reference files

For the full structural guide, conventions, and examples for writing z-schema skills:

- [references/skill-structure.md](references/skill-structure.md) — Skill anatomy, frontmatter schema, progressive disclosure, writing patterns, and complete examples

---

## Core loop summary

1. **Understand** what the skill should do
2. **Research** the z-schema docs and source to ground the skill in accuracy
3. **Draft** the SKILL.md and any reference files
4. **Test** with realistic prompts
5. **Review** results with the user
6. **Iterate** until the skill is accurate, useful, and well-triggered
7. **Verify** all code examples, API names, and types against current source

Break these into tracked tasks so nothing gets skipped. Take your time writing a good draft, then look at it with fresh eyes and improve it before sharing.
