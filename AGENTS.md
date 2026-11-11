# Explainova development workflow

- Build and review one feature or milestone at a time; follow `PROJECT_STATUS.md` and the approved PRD/API/database designs.
- Update `PROJECT_STATUS.md` after each implementation session with completed work, checks, limitations, and the next task.
- After every completed feature or milestone, remind the user to commit and push the changes if they have not already been committed. Do not create a time-based reminder for this event-driven workflow.
- The project repository is `https://github.com/Yash-R09/ExplaiNova` and ongoing development uses `dev`. Leave changes uncommitted for code review and manual QA. After both are complete, wait for the user to explicitly ask before committing. Push when the user authorizes it.
- Before publishing to this public repository, verify that secrets, `.env` files, generated media, dependencies, and build outputs are excluded. Keep `.env.example` files free of credential values.
- Preserve the independent root video prototype while building the full app in `apps/web`.
- Provider keys stay server-only. ElevenLabs voices must be available through the free-tier API unless the user changes that requirement.
