# How this repository is governed — the enterprise account

*Demonstration only.* This document describes how the demonstration portal is
governed on GitHub and how a program that adopted the pattern would be
provisioned. No government adoption, endorsement, partnership, or deployment is
claimed or implied. Facts about GitHub's platform are taken from GitHub Docs
(Enterprise Cloud) as read on 2026-09-07.

## Start here

If you run a program: the first two sections say who owns what and what
"transfer intact" means. If you are the technical lead: the provisioning
walkthrough and the current-state table are yours.

## 1. Three layers, one rule about ownership

```
Enterprise account   kuleana                 rules that bind every organization under it
└── Organization     Aina-Design-Corp        the people, teams, and repositories of one owner
    └── Repository   kuleana-portal          this demonstration: register, checks, public pages
```

- **The enterprise account** is the administrative layer above organizations:
  policies that every organization must follow, billing, an audit log of
  administrative actions, and GitHub's own compliance reports. Āina Design Corp
  established the enterprise in September 2026 and joined its organization to
  it. Its address is `github.com/enterprises/kuleana`; enterprise pages are
  visible only to the enterprise's own members and administrators, so that
  address identifies the account rather than offering anything to read. The
  public face of the enterprise is this repository and the demonstration site.
- **The organization** owns the repositories and the people. It is the unit
  GitHub lets an owner hand over: an organization can be removed from one
  enterprise and invited into another, with its repositories, history, and
  public pages intact.
- **The repository** holds the project register, the checks that run on every
  change, and the source of the public pages.

The rule that follows: **a program that adopts this pattern gets its own
organization inside the enterprise.** Its staff never become members of this
demonstration repository. They sign in with their own directory, work in their
own organization, and can take that organization with them at any time.

## 2. What the enterprise sets for every organization

An enterprise owner can enforce, across every organization in the enterprise:
the default level of access members have to repositories (set to none, so
access is granted deliberately, by team), who may create, delete, or transfer
repositories and change their visibility, whether private repositories may be
forked, who may invite outside collaborators, and two-factor sign-in for
everyone. The enterprise audit log keeps administrative and access events for
180 days, is queryable by API, and can be streamed to a storage account the
adopting program controls. GitHub's SOC 2 Type 2 report, ISO/IEC 27001:2022
certificate, and CSA STAR certification are downloadable from the enterprise's
compliance page and can accompany a program's architecture documentation.

Identity is configured per organization, not for the whole enterprise: each
organization can bind to its own SAML identity provider, provision and remove
accounts by SCIM, and map its teams to identity-provider groups. That is what
keeps one organization's sign-in independent of another's.

## 3. Provisioning an adopting program's organization

The order below is the order it happens in; each step names who acts.

1. **Create the organization** from the enterprise's Organizations page (an
   enterprise owner). The new organization inherits every enforced policy, the
   audit log, and the compliance reports on creation.
2. **Baseline settings** (organization owner): profile and contact for the
   program, not the contractor; domain verification by the program's DNS
   administrator so notifications can be restricted to its addresses; default
   member access none; Actions limited to GitHub-provided and in-organization
   workflows; public Pages allowed.
3. **Teams** (organization owner): one per role the review process needs, for
   example administrators, a coordinator, and departmental approvers. Teams are
   empty until identity is live.
4. **The repository** (organization owner): create it from this demonstration
   as a *template*, never by transferring this repository. A template copy
   starts with a single commit and carries files only, so the program's record
   begins on its own first day with no sample data in its history. Then, as
   reviewed changes: adopt the production schema (v1.0); load the program's
   own data through the intake workflow; add a `CODEOWNERS` file that names
   which team must approve changes in which folder; add a ruleset on the main
   branch that requires a pull request, an approval, code-owner review, and the
   `validate` check, and that binds administrators too; add a deployment
   environment for the public pages whose required reviewers are the program's
   approvers (the release switch); keep any service credentials as
   environment-scoped secrets; grant each team its repository role.
5. **Identity** (the program's identity administrator with the organization
   owner): enable SAML single sign-on on the organization and test it without
   enforcing; turn on SCIM provisioning so accounts appear and disappear from
   the identity provider; enable team synchronization so identity-provider
   groups decide team membership; enforce single sign-on once every intended
   member has signed in once. Enforcement removes anyone who has not signed in
   through the provider, including the contractor's own staff, so the
   contractor's accounts are either issued as guest identities in the program's
   directory for the term, or single sign-on stays enabled but not enforced
   until the contractor leaves.
6. **A reviewer's first day**: added to a group in the identity provider;
   receives an invitation; signs in through the provider; lands on the right
   team with access to exactly one repository; approves a pull request and
   watches the checks and the deployment gate do the rest. None of it is a
   contractor action.
7. **Offboarding**: removal from the identity-provider group removes the
   account from the organization; the audit log records it; the repository
   history keeps every approval the person made, attributed to them.
8. **Exit**: the organization stays in the enterprise, leaves it to run
   standalone, or joins the program's own enterprise account. Repositories,
   history, and public pages are unchanged in every case. One detail worth
   knowing: on GitHub's free plan, code-owner enforcement does not apply in
   private repositories, so a standalone organization keeping a private
   register would keep a paid plan for that one feature.

## 4. What this demonstration repository has today

Stated so that nobody reads the pattern above as a description of the demo.

| Control | In this repository now | In the pattern (step 4) |
|---|---|---|
| Enterprise policies | Enterprise established; policies being set | Enforced across every organization |
| Default member access | Set by the organization | None; access by team |
| Main-branch protection | `validate` status check required | Ruleset: pull request, approval, code-owner review, `validate`, binds administrators |
| `CODEOWNERS` | None | Names the approving team per folder |
| Deployment gate | `PUBLISH_PAGES` variable and the `github-pages` environment | Same, plus required reviewers on the environment |
| Public pages | Built by workflow; custom domain kuleana.ainadesign.org | Built by workflow; the program's own address |
| Identity | Two-factor required | SAML single sign-on, SCIM, team sync on the program's provider |

This table is updated when the demonstration's own controls change.

## 5. Boundaries

- The demonstration keeps fictional sample data and claims no adoption.
- Nothing here describes any government's systems, directories, or decisions;
  the walkthrough is the platform's mechanism, stated generically.
- Platform facts are GitHub's, cited from GitHub Docs; Āina Design Corp makes no
  certification claims of its own here.

## Sources

GitHub Docs, Enterprise Cloud (read 2026-09-07): About enterprise accounts ·
Adding organizations to your enterprise · Removing organizations from your
enterprise · Enforcing repository management policies in your enterprise ·
About the audit log for your enterprise · Streaming the audit log for your
enterprise · Accessing compliance reports for your enterprise · Managing your
role in an organization owned by your enterprise · About SCIM for organizations
· Enabling and testing SAML single sign-on for your organization · Enforcing
SAML single sign-on for your organization · Synchronizing a team with an
identity provider group · Creating a repository from a template · Transferring
a repository.
