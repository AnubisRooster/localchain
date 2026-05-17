---
name: jira-create-issues
description: >
  Create Jira Epics and child Stories/Tasks via the mcp-atlassian server (self-hosted Jira Data
  Center), enforcing a mandatory field set (Summary, Description, Epic Link, Estimate, Components,
  Labels, Function area, Acceptance Criteria, Definition of Ready, Definition of Done) and a
  hierarchical WBS numbering rule (Initiative X.0 -> Epic X.Y -> Story X.Y.Z). Enforces the
  three-orthogonal-dimensions model (Pillars=Components, Teams=Labels, Programs=Initiatives),
  8 pillar-based components, team/product/BU labels, cross-pillar work rules, and initiative gating.
  Always shows the proposed payload to the user for approval before creating. Use when the user
  asks to create, draft, file, scaffold, or open a Jira Epic, Story, Task, or sub-tasks.
---

# Jira: Create Epics and Stories/Tasks (mcp-atlassian)

This skill governs how the agent creates Jira issues through the `mcp-atlassian` MCP server against a **self-hosted Jira Data Center** instance. It enforces a stricter mandatory field set than Jira's screens require and the organisation's three-dimension governance model.

---

## Initiative → Epic → Story Hierarchy

This project uses a three-level hierarchy:

1. **Initiative** — top-level parent. Carries the WBS root number with a **pillar prefix** (e.g. `0.0 OPS: Operational Tasks`, `1.0 DCM: Knowledge Graph Platform`).
2. **Epic** — child of the Initiative. Inherits the Initiative's WBS prefix (e.g. `0.1 TPM Tasks`, `1.1 Entity Extraction Pipeline`).
3. **Story / Task** — child of the Epic. Inherits the Epic's prefix (e.g. `0.1.1 Set up monitoring dashboard`).

### Initiative Pillar Prefixes

| Prefix   | Pillar                      | WBS Range |
| -------- | --------------------------- | --------- |
| `OPS-`   | Operations (Non-Tech)       | `0.x`     |
| `DCM-`   | Data, Context & Memory      | `1.x`     |
| `RO-`    | Reasoning & Orchestration   | `2.x`     |
| `RT-`    | Runtime                     | `3.x`     |
| `INFRA-` | Operations & Infrastructure | `4.x–5.x` |
| `EVAL-`  | Evaluation                  | `6.x`     |
| `MF-`    | Models                      | `7.x–8.x` |
| `HIVE-`  | HiVE Platform               | `9.x`     |
| `BU-`    | Cross-pillar BU delivery    | `10.x+`   |

### Initiative Gating Rule

An Initiative requires **3+ Epics** and a **3+ month timeline**. Work that doesn't meet this threshold should be modelled as Epics under an existing Initiative, not as new Initiatives.

---

## Three Orthogonal Dimensions

| Dimension    | Jira mechanism       | Purpose                                                    |
| ------------ | -------------------- | ---------------------------------------------------------- |
| **Pillar**   | Components (8 total) | *What technical capability area does this work belong to?* |
| **Team/Product** | Labels (prefixed)| *Who is doing this work? For what product?*                |
| **Program**  | Initiatives (gated)  | *What major program of work does this fall under?*         |

---

## Components — Pillars Only (8 Total)

Every issue MUST have at least one component. Cross-pillar work gets multiple components.

| Component                     | Scope                                                                |
| ----------------------------- | -------------------------------------------------------------------- |
| **Data, Context & Memory**    | RAG, data engineering, knowledge graphs, entity extraction, memory   |
| **Reasoning & Orchestration** | Agent orchestration, intent routing, model routing, tool use, MCP    |
| **Runtime**                   | Model runtime (inference), agent runtime, on-device execution        |
| **Operations & Infrastructure** | GPU clusters, CI/CD, deployment, monitoring, Kubernetes, cloud infra |
| **Evaluation**                | Model eval frameworks, benchmarking, safety testing, auto pipelines  |
| **Models**                    | Model training, fine-tuning, quantization, model factory             |
| **HiVE Platform**             | Cross-pillar platform integration, SDK, shared services              |
| **Operations (Non-Tech)**     | Hiring, governance, tooling, compliance, process improvements        |

---

## Labels — Teams and Products

Labels encode **who** is doing the work and **what product** it serves. **Every issue MUST have at least one `team:*` label.**

### Team labels (`team:*`)

`team:infra-prc`, `team:infra-row`, `team:ro-prc-p`, `team:ro-prc-e`, `team:ro-intent`,
`team:ro-tools`, `team:eval`, `team:models-prc`, `team:models-row`, `team:runtime-model`,
`team:runtime-agent`, `team:dcm`, `team:hive-core`

### Product / BU labels (`product:*`, `bu:*`)

`product:qira`, `product:tianxi`, `product:prc-e`, `product:hive`, `product:atp`,
`bu:idg-gic`, `bu:idg-cpc`, `bu:idg-ret`, `bu:idg-phone`, `bu:prc-enterprise`,
`bu:ssg-aics`, `bu:dtit`, `bu:ssg-row`, `bu:isg-row`, `bu:isg-prc`

### Special labels

| Label          | Purpose                                       |
| -------------- | --------------------------------------------- |
| `cross-pillar` | Issue involves temporary cross-pillar support |

---

## Mandatory fields (always)

Every Story/Task created under an Epic MUST have all of these populated:

| Field | Type | Tool parameter / Custom field |
|---|---|---|
| Summary | string | `summary` (system) |
| Description | markdown | `description` (system) — also carries DoR and DoD |
| Epic Link | issue key | `customfield_10006` via `additional_fields.epic_link` |
| Estimate (Story Points) | number | `customfield_10816` via `additional_fields` |
| Component/s | comma-separated string | `components` (dedicated tool param) |
| Labels | array | `labels` in `additional_fields` — at least one `team:*` label |
| Function area | string (pillar name) | `customfield_16400` via `additional_fields` — auto-derived from Components |
| Acceptance Criteria | markdown | `customfield_10515` via `additional_fields` (Story screen only) |
| Definition of Ready | markdown | **Description body only** — not on any screen |
| Definition of Done | markdown | **Description body only** — not on any screen |

For an **Epic** itself, Epic Link is **not** applicable. Instead, an Epic requires:

| Field | Type | Custom field |
|---|---|---|
| Epic Name | string | `customfield_10005` (required by Jira for Epics) |

### Screen availability

| Field               | Epic screen | Story screen | Fallback                                    |
| ------------------- | ----------- | ------------ | ------------------------------------------- |
| Summary             | ✅           | ✅            | —                                           |
| Description         | ✅           | ✅            | —                                           |
| Estimate            | ✅           | ✅            | —                                           |
| Component/s         | ✅           | ✅            | —                                           |
| Labels              | ✅           | ✅            | —                                           |
| Epic Name           | ✅           | N/A          | —                                           |
| Epic Link           | N/A         | ✅            | —                                           |
| Acceptance Criteria | ❌           | ✅            | Embed in Description (Epics)                |
| Definition of Ready | ❌           | ❌            | **Always** embed in Description             |
| Definition of Done  | ❌           | ❌            | **Always** embed in Description             |

**Rule:** DoR and DoD are **never** sent via `additional_fields` — they do not appear on any Jira screen and will be silently rejected. Always embed them in the `description` body.

---

## WBS numbering

Every issue carries a Work Breakdown Structure prefix at the front of both the **Summary** and (for Epics) the **Epic Name**:

| Level | Issue type | Prefix shape | Example |
|---|---|---|---|
| 1 | Initiative | `X.0` | `0.0 Operational Tasks & General Work` |
| 2 | Epic | `X.Y` | `0.4 Data and Infra Ops Tasks` |
| 3 | Story / Task | `X.Y.Z` | `0.4.7 Provision dashboard refresh job` |
| 4 | Subtask | `X.Y.Z.N` | `0.4.7.1 Add pre-drain health check script` |

### Computing the next number

Before creating an Epic or a Story/Task, scan existing siblings and pick the **lowest unused integer** for the new level. Always show the user the scan result and the chosen number before creating.

**Creating an Epic under Initiative `<INIT>`:**

1. Run `jira_get_issue` on `<INIT>` and extract the leading `X.0` from `summary`.
2. List children Epics via JQL: `project = <PROJ> AND "Parent Link" = <INIT> AND issuetype = Epic`
3. Parse the leading `X.Y` prefix from each child summary. Collect the `Y` values.
4. **Next `Y` = max(Y) + 1**, floor of `1` if set is empty.
5. Show the user: "Initiative `<INIT>` is `X.0`. Existing Epics: `<list>`. Next Epic will be `X.<nextY>`. Confirm?"

**Creating a Story/Task under Epic `<EPIC>`:**

1. Run `jira_get_issue` on `<EPIC>` and extract the leading `X.Y` from `summary`.
2. List children: `project = <PROJ> AND "Epic Link" = <EPIC> AND issuetype in (Story, Task)`
3. Parse the leading `X.Y.Z` prefix from each child summary. Collect the `Z` values.
4. **Next `Z` = max(Z) + 1**, floor of `1` if set is empty.

---

## Function area mapping

`customfield_16400` ("Function area") must be included in every new issue. **Always derive it automatically from the Components field.**

| Pillar value | Maps from component |
|---|---|
| `Data, Context, & Memory` | `Data, Context & Memory` |
| `Reasoning & Orchestration` | `Reasoning & Orchestration` |
| `Runtime` | `Runtime` |
| `Infrastructure` | `Operations & Infrastructure` |
| `Operations` | `Operations (Non-Tech)` |
| `Model Evaluation` | `Evaluation` |
| `Model Factory` | `Models` |
| `HiVE Platform` | `HiVE Platform` |

**Resolution rules when an issue has multiple components:**
1. If all components point to the same pillar → use that pillar.
2. If components span multiple pillars → set Function area from the **first listed component** and add label `cross-pillar`.

---

## Operating contract

1. **Never silently omit a mandatory field.** If a value is missing, draft a placeholder from conversation context and present the full draft to the user for confirmation.
2. **Always show the proposed payload before creating.** Single create AND batch create. Wait for an affirmative reply. No exceptions.
3. **Always inherit a WBS prefix from the parent.** If the parent has no WBS prefix, stop and tell the user.
4. **Never assume the project key.** Ask if not stated.
5. **Never assume Epic Link.** If the user says "create stories under Epic X" without a key, search first and ask which one.
6. **Use the MCP server, not raw REST.** All operations go through `mcp-atlassian` tools.
7. **Never use components outside the 8-pillar list.** Map old names to the correct pillar component and confirm.

---

## Workflow

### A. Creating a single Story/Task under an existing Epic

1. **Gather inputs.** Required: `project_key`, `epic_key`, `summary`, `components`, `labels`.
2. **Compute WBS.** Read `<epic_key>` prefix `X.Y`; scan child Stories/Tasks; pick next `Z`.
3. **Draft all mandatory fields.** Mark uncertain content as `TBD:`.
4. **Pre-flight** as needed (Epic key valid? Components valid? WBS scan complete?).
5. **Show the full draft** to the user with all mandatory fields.
6. **Confirm** ("Create this Story now? Reply with edits or 'go'.").
7. **Create** via `jira_create_issue`.
8. **Report result.** Show the created issue key and summary.

### B. Creating a new Epic under an Initiative

1. Gather: `project_key`, `initiative_key`, `summary`, `components`, `labels`.
2. **Compute WBS.** Read `<initiative_key>` prefix `X.0`; scan child Epics; pick next `Y`.
3. Set `customfield_10005` (Epic Name) to the same `"X.Y <title>"` string.
4. Set `customfield_12913` (Parent Link) to `<initiative_key>`.
5. **Show the draft**, confirm, then create with `issue_type: "Epic"`.
6. **After creation**, call `jira_create_issue_link` with `type_name: "multi-level hierarchy [GANTT]"`.

### C. Scaffolding multiple Stories under one Epic

1. Gather the Epic key and a list of work items.
2. **Compute consecutive WBS.** Allocate `X.Y.<nextZ>`, `X.Y.<nextZ+1>`, ...
3. For each item, draft all mandatory fields.
4. **Validate first**: call `jira_batch_create_issues` with `validate_only: true`.
5. Show a compact numbered table and ask for batch confirmation.
6. Create with `jira_batch_create_issues` (`validate_only: false`).

---

## Tool call shape

Use `jira_create_issue` with `additional_fields` as a **JSON-encoded string**, not a JSON object.

Example payload for a Story:

```json
{
  "project_key": "LATC",
  "summary": "0.4.7 Provision dashboard refresh job on shared VM",
  "issue_type": "Story",
  "description": "## Context\n...\n\n## Definition of Ready\n- [ ] AC reviewed\n\n## Definition of Done\n- [ ] Code merged, CI green",
  "components": "Operations & Infrastructure",
  "additional_fields": "{\"epic_link\":\"LATC-1304\",\"customfield_10816\":3,\"customfield_16400\":\"Infrastructure\",\"customfield_10515\":\"- [ ] Given the VM is healthy, then fresh data lands within 5 min.\",\"labels\":[\"team:infra-row\"]}"
}
```

Notes:
- `additional_fields` is a JSON **string**.
- DoR and DoD go in `description` only — never in `additional_fields`.
- After creating an Epic, always call `jira_create_issue_link` with the GANTT hierarchy link.

---

## Estimation guidance

Default to **Story Points** (1, 2, 3, 5, 8, 13):

| Points | Rough meaning |
|---|---|
| 1 | Trivial; under half a day; no unknowns. |
| 2 | A focused day or less; well-understood. |
| 3 | A couple of days; minor unknowns. |
| 5 | Most of a sprint slice; some integration risk. |
| 8 | Full sprint slice; non-trivial unknowns. |
| 13 | Probably needs splitting; flag this in Description. |

---

## Anti-patterns to avoid

- **Don't pass JSON objects to `additional_fields`.** It must be a JSON **string**.
- **Don't set Epic Link on an Epic.** Use Epic Name (`customfield_10005`) on Epics.
- **Don't skip the WBS scan.** Never invent the next number — always re-run the JQL scan.
- **Don't reuse a number.** Use `max+1` even if there are gaps.
- **Don't omit Function area.** Always derive and include `customfield_16400`.
- **Don't pass DoR or DoD via `additional_fields`.** Always embed in Description body.
- **Don't pass AC via `additional_fields` on Epics.** Embed in Epic description body.
- **Don't use old sub-component names.** Map to the correct pillar component.
- **Don't omit Labels.** At least one `team:*` label is mandatory.
- **Don't bypass confirmation.** Always show the full proposed payload and wait for go-ahead.

---

## Quick field reference

| Field | Custom field ID |
|---|---|
| Story Points / Estimate | `customfield_10816` |
| Sprint | `customfield_10004` |
| Epic Name | `customfield_10005` |
| Epic Link | `customfield_10006` |
| Acceptance Criteria | `customfield_10515` |
| Function area | `customfield_16400` |
| Definition of Ready | `customfield_16516` |
| Definition of Done | `customfield_16544` |
| Parent Link (Portfolio) | `customfield_12913` |

---

## References

- MCP tools: `jira_create_issue`, `jira_batch_create_issues`, `jira_create_issue_link`, `jira_get_project_components`, `jira_search`, `jira_search_fields`, `jira_get_issue`, `jira_get_sprints_from_board`.
- Server: `mcp-atlassian` (sooperset / SharkyND mcp-atlassian, stdio over `uvx`).
