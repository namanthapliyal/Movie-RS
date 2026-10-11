---
name: rare-ui-enhancement
description: Improve this app's frontend with suitable Rare UI components from swamimalode07/rare-ui while preserving existing UX, accessibility, responsiveness, and project conventions.
---

# Rare UI frontend enhancement

Use this workflow for frontend/UI enhancement requests in this repository. Rare UI is a shadcn component registry, not a general UI generation agent. Choose and integrate a registry component only when it materially improves the requested experience; otherwise follow the same review and validation steps using existing project components.

## Before changing UI

- Inspect the target page/component, its parent and related shared styles/components, relevant UI tests, and the current `components.json` and `package.json`.
- Read the Rare UI installation instructions at <https://github.com/swamimalode07/rare-ui#quick-start> and check the selected component's registry source/docs before installation. Use the project-terminal shadcn command documented by Rare UI:

  ```powershell
  npx shadcn@latest add swamimalode07/rare-ui/<component-name>
  ```

- Replace `<component-name>` with a component that directly serves the requested interaction. Review the generated/changed files and dependencies immediately; integrate with existing code rather than replacing working application structure wholesale.
- This app currently has custom Tailwind UI components and may not have a `components.json`. Check first. Do not run an interactive initializer or overwrite project configuration blindly; if shadcn setup is required and cannot be done compatibly without a significant project decision, ask before changing the setup.
- The Rare UI README documents MCP setup for Claude Code, Cursor, and VS Code, but does not document a GitHub Copilot CLI MCP setup. Do not claim Rare UI MCP is configured for Copilot CLI. For this repository's Copilot workflow, use its documented shadcn registry command from the project terminal when needed.

## Implementation expectations

- Keep changes scoped to the requested UI, reuse existing app primitives and design tokens, and preserve all existing behaviors, local data handling, and routes.
- Review component code, props, dependencies, motion behavior, and any copied source comments/license notices. Rare UI components use Motion and honor `prefers-reduced-motion`; preserve reduced-motion support when adapting them.
- Verify mobile/narrow layouts, keyboard access and focus behavior, accessible names/semantics, loading/empty/error states, and contrast. Do not rely on hover-only actions.
- Rare UI's license requires visible attribution with a link to <https://rareui.com> in a footer, About page, credits screen, or README, and requires retaining attribution/copyright notices in copied source. If using a Rare UI component, ensure both requirements are met; do not remove those notices.
- Do not add a component just for decoration when it worsens usability, accessibility, bundle size, or consistency.

## Validation

- Add or update Playwright coverage for the changed interaction under `tests/ui`; keep it deterministic and isolate localStorage or stub external requests where appropriate.
- Run the smallest relevant UI tests first, then `npm run test:ui` for UI-impacting changes. Also run `npx tsc --noEmit` and `npm run build` when component code, imports, dependencies, or shared styles change. Run checks serially to avoid `.next` build/type-generation races.
- Use the local-regression-review skill for a broader review or full regression pass, including API checks, Graphify blast-radius tracing, and curl smoke checks where relevant.
