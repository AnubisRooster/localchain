---
name: confluence-dc-mcp
description: >
  Extend the mcp-atlassian MCP server to connect to a self-hosted Confluence Data Center instance.
  Use this skill whenever the user mentions Confluence Data Center, self-hosted Confluence, on-prem
  Confluence, Confluence behind a VPN, setting up Confluence MCP, Confluence personal access tokens,
  searching Confluence wiki pages, creating or updating Confluence pages, CQL queries, Confluence
  spaces, or any workflow that involves reading or writing documentation in a self-hosted Confluence.
  Also trigger when the user asks to extend their existing mcp-atlassian Jira setup with Confluence,
  or wants to connect to an internal wiki. Complements the jira-create-issues skill — both share
  the same mcp-atlassian MCP server process.
---

# Confluence Data Center — MCP Skill (mcp-atlassian)

This skill governs how the agent interacts with a **self-hosted Confluence Data Center**
(or Server) instance via the `mcp-atlassian` MCP server. It complements the
`jira-create-issues` skill; both products share one MCP server process.

---

## Architecture

```
┌──────────────┐  stdio   ┌──────────────────┐  HTTPS/PAT  ┌─────────────────────┐
│ Cursor /     │◄────────►│ mcp-atlassian    │◄───────────►│ Confluence DC       │
│ Claude Code  │          │ (local process)  │             │ (on-prem / VPN)     │
└──────────────┘          └──────────────────┘             └─────────────────────┘
```

The MCP server runs locally on the user's machine (inside the VPN) and connects
to Confluence DC via its REST API using a Personal Access Token (PAT).

---

## MCP migration workflow (Confluence)

Use this workflow when migrating Confluence work from ad hoc/manual updates to MCP-driven operations:

1. **Inventory first**: identify source spaces/pages and target destination space tree.
2. **Read-only baseline**: use read tools first (`confluence_search`, `confluence_get_page`, history/children calls) to confirm current state.
3. **Draft migration plan**: present page mapping (source -> destination), labels, attachment handling, and ordering to the user.
4. **Explicit approval gate**: wait for user sign-off before any create/update/move/delete call.
5. **Execute in batches**: migrate in small sets, then verify each batch with read calls.
6. **Post-migration verification**: confirm hierarchy, labels, attachments, and key page links.
7. **Report + rollback notes**: summarize exactly what changed and how to revert high-risk edits.

Rule: for migration tasks, do not run write calls until plan and batch scope are explicitly approved.

---

## MANDATORY: Approval before write operations

**NEVER create, update, or delete Confluence pages without the user's explicit approval.**

When the user asks to create or update a Confluence page:

1. **Draft the content** in the conversation (or as a local file) and present it to
   the user for review.
2. **Wait for explicit approval** — the user must confirm before calling
   `confluence_create_page`, `confluence_update_page`, or `confluence_delete_page`.
3. **Only then execute** the write operation.

This applies to **all write operations**: creating pages, updating page content,
adding comments, uploading attachments, moving pages, adding/removing labels, and
deleting pages.

Read operations (`confluence_search`, `confluence_get_page`, `confluence_get_page_children`,
etc.) do **not** require approval.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `CONFLUENCE_URL` | **Yes** | Base URL of your Confluence instance (e.g. `https://confluence.yourcompany.com`) |
| `CONFLUENCE_PERSONAL_TOKEN` | **Yes (DC)** | PAT from your Confluence profile |
| `CONFLUENCE_USERNAME` | Alt | Email/username for basic auth (DC < 7.9 only) |
| `CONFLUENCE_API_TOKEN` | Alt | Password/token for basic auth (DC < 7.9 only) |
| `CONFLUENCE_SSL_VERIFY` | No | Set to `false` for self-signed certificates |
| `TOOLSETS` | No | Comma-separated toolset names to enable |
| `ENABLED_TOOLS` | No | Comma-separated specific tool names to enable |
| `READ_ONLY_MODE` | No | Set to `true` to disable all write operations |

**Tip:** If the user already has `mcp-atlassian` configured for Jira, add the
`CONFLUENCE_*` env vars to the **same** server entry — both products share one process.

---

## MCP config snippets

### Cursor (Settings → AI → MCP Servers)

| Setting | Value |
|---|---|
| Server name | `mcp-atlassian` |
| Command | `uvx mcp-atlassian` |
| `CONFLUENCE_URL` | `https://confluence.yourcompany.com` |
| `CONFLUENCE_PERSONAL_TOKEN` | `<your-confluence-pat>` |

### Claude Code / Claude Desktop (`~/.claude/mcp_servers.json`)

```jsonc
{
  "mcp-atlassian": {
    "command": "uvx",
    "args": ["mcp-atlassian"],
    "env": {
      // Existing Jira config (if present)
      "JIRA_URL": "https://jira.yourcompany.com",
      "JIRA_PERSONAL_TOKEN": "your-jira-pat",
      // Add these for Confluence DC
      "CONFLUENCE_URL": "https://confluence.yourcompany.com",
      "CONFLUENCE_PERSONAL_TOKEN": "your-confluence-pat"
    }
  }
}
```

Config file locations:
- **Windows (installer):** `%APPDATA%\Claude\claude_desktop_config.json`
- **Windows (Store / MSIX):** `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

---

## Generating a Personal Access Token

1. Log in to your Confluence DC instance.
2. Click your avatar → **Profile** → **Personal Access Tokens**.
3. Click **Create token**. Name it (e.g. `claude-mcp`), set an expiry.
4. Copy the token immediately — it won't be shown again.

> If the instance runs Confluence DC < 7.9, PATs are not available. Fall back to
> HTTP basic auth with `CONFLUENCE_USERNAME` + `CONFLUENCE_API_TOKEN` (where the
> token is your password). PATs are strongly preferred.

---

## Available tools

### Pages

| Tool | Description |
|---|---|
| `confluence_search` | Search content with CQL or simple text |
| `confluence_get_page` | Get a page by ID, or by title + space key |
| `confluence_get_page_children` | List child pages and folders |
| `confluence_get_page_history` | Get version history for a page |
| `confluence_get_page_diff` | Unified diff between two page versions |
| `confluence_create_page` | Create a new page in a space (**requires approval**) |
| `confluence_update_page` | Update page title, body, or parent (**requires approval**) |
| `confluence_delete_page` | Delete a page — moves to trash (**requires approval**) |
| `confluence_move_page` | Move a page to a new parent or space (**requires approval**) |

### Comments

| Tool | Description |
|---|---|
| `confluence_get_comments` | Get comments on a page |
| `confluence_add_comment` | Add a comment to a page (**requires approval**) |
| `confluence_reply_to_comment` | Reply to an existing comment thread (**requires approval**) |

### Labels & Attachments

| Tool | Description |
|---|---|
| `confluence_get_labels` | Get labels on a page |
| `confluence_add_label` | Add a label to a page (**requires approval**) |
| `confluence_upload_attachment` | Upload a single attachment (**requires approval**) |
| `confluence_upload_attachments` | Upload multiple attachments (**requires approval**) |
| `confluence_get_attachments` | List attachments on a page |
| `confluence_download_attachment` | Download an attachment |
| `confluence_delete_attachment` | Delete an attachment (**requires approval**) |
| `confluence_get_page_images` | Get all images as base64 inline content |

### Users

| Tool | Description |
|---|---|
| `confluence_search_user` | Search for Confluence users |

> **`confluence_get_page_views` is Cloud-only.** Do not call it on Data Center — it
> will error. Use `confluence_get_page_history` as an alternative for activity tracking.

---

## CQL (Confluence Query Language) reference

Used by `confluence_search`. Basic syntax:

```
field operator value [AND|OR field operator value ...]
```

### Key fields on Data Center

| Field | Type | Description |
|---|---|---|
| `type` | keyword | `page`, `blogpost`, `comment`, `attachment` |
| `space` | keyword | Space key (e.g. `"ENG"`, `"HR"`) |
| `title` | text | Page title |
| `text` | text | Full-text body content |
| `label` | keyword | Labels attached to content |
| `creator` | user | Username who created the content |
| `contributor` | user | Any user who edited the content |
| `lastModified` | date | When content was last updated |
| `created` | date | When content was created |
| `id` | number | Content ID |
| `parent` | number | Parent page ID |
| `ancestor` | number | Any ancestor page ID (recursive) |

### Operators

| Operator | Meaning | Applicable to |
|---|---|---|
| `=` | Exact match | keyword, number |
| `!=` | Not equal | keyword, number |
| `~` | Contains (full-text) | text fields |
| `!~` | Does not contain | text fields |
| `>` `<` `>=` `<=` | Comparison | date, number |
| `IN` | In a list | keyword |
| `NOT IN` | Not in a list | keyword |

### Date functions

```
now()           # current time
now("-7d")      # 7 days ago
now("-4w")      # 4 weeks ago
now("-3M")      # 3 months ago
now("-1y")      # 1 year ago
startOfDay()    startOfWeek()    startOfMonth()    startOfYear()
endOfDay()      endOfWeek()      endOfMonth()      endOfYear()
```

### Example CQL queries

```cql
-- All pages in a space
type = page AND space = "ENG"

-- Full-text search
type = page AND text ~ "Kubernetes deployment"

-- Pages modified this week
type = page AND lastModified >= startOfWeek()

-- Pages created by a user in the last 30 days
type = page AND creator = "jdoe" AND created > now("-30d")

-- Pages with multiple labels
type = page AND label = "api" AND label = "v2"

-- Pages in multiple spaces
type = page AND space IN ("ENG", "PLATFORM", "DEVOPS")

-- Blog posts from this year, newest first
type = blogpost AND created >= startOfYear() ORDER BY created DESC

-- All pages under a parent (recursive)
ancestor = 12345678 AND type = page

-- Attachments on a specific page
type = attachment AND container = 12345678

-- Pages NOT labelled "archived"
type = page AND space = "ENG" AND label != "archived"

-- Complex: recent architecture docs excluding drafts
type = page AND space = "ENG" AND label = "architecture"
  AND label != "draft" AND lastModified > now("-90d")
  ORDER BY lastModified DESC
```

**DC-specific notes:**
- Space keys are **case-sensitive** (usually uppercase).
- Personal spaces use `~username` and must be quoted: `space = "~jsmith"`.
- `content.property` field is Cloud-only — not available on DC.
- Full-text search uses the DC index; there may be a short delay after edits.
- Default result limit is typically 25; adjust with the `limit` parameter.

---

## Data Center vs Cloud key differences

| Area | Cloud | Data Center |
|---|---|---|
| Auth | API token (email + token) | Personal Access Token |
| URL format | `*.atlassian.net/wiki` | Custom domain (no `/wiki` suffix typically) |
| Content API | v2 (`/wiki/api/v2/...`) | v1 (`/rest/api/content/...`) — handled automatically |
| Page Analytics | Available | **Not available** — skip `confluence_get_page_views` |
| SSL | Managed by Atlassian | May need `CONFLUENCE_SSL_VERIFY=false` |
| Network | Internet-accessible | Requires VPN / local network access |

The mcp-atlassian server abstracts these differences — the same tool names and
parameters work for both deployment types.

---

## Troubleshooting

| Symptom | Likely cause & fix |
|---|---|
| No Confluence tools appear | `CONFLUENCE_URL` / `CONFLUENCE_PERSONAL_TOKEN` not set; restart after updating config |
| SSL: CERTIFICATE_VERIFY_FAILED | Add `"CONFLUENCE_SSL_VERIFY": "false"` to env, or install enterprise CA into OS trust store |
| 401 Unauthorized | PAT expired — generate a new one; or wrong user |
| Connection refused / timeout | VPN not connected; test URL in browser from same machine |
| 403 Forbidden | PAT user lacks space permissions; ask Confluence admin |
| `confluence_search` returns empty | Check CQL syntax; space keys are case-sensitive; index may lag |
| `confluence_create_page` "space not found" | Use the space **key** (e.g. `ENG`), not the display name |
| `confluence_update_page` version conflict | Re-fetch the page to get the current version number, then retry |
| `confluence_get_page_views` error | Cloud-only — do not use on DC |
| Attachment upload fails | Check file size limits (admin-configurable, default ~10–25 MB); user needs "Add Attachment" permission |

For proxy environments, add `"HTTPS_PROXY": "http://proxy.yourcompany.com:8080"` to the env block.

---

## Useful references

- mcp-atlassian source: https://github.com/sooperset/mcp-atlassian
- Confluence DC REST API: https://developer.atlassian.com/server/confluence/confluence-server-rest-api/
