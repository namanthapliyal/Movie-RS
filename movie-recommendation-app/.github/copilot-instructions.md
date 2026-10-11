# Repository review guidance

When asked to review local changes, review a commit, or check a change for regressions before committing, follow the `local-regression-review` skill in `.github/skills/local-regression-review/SKILL.md`. Use Graphify to estimate blast radius, then verify graph-derived relationships in source. Review the actual working-tree and commit diff, run the applicable checks from that skill, and report reproducible findings with file and line references. Do not modify files or create a commit unless asked.

When asked to enhance the frontend/UI, follow the `rare-ui-enhancement` skill in `.github/skills/rare-ui-enhancement/SKILL.md`. Check Rare UI for an appropriate component, integrate it with existing project conventions, preserve its attribution requirements, and validate the UI behavior.
