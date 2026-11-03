# Open Questions

These are questions that the repository does not answer. Each one blocks a section of `docs/VISION.md` that is marked "Not stated: an owner decides". When an owner answers a question, record the answer in `docs/VISION.md` and remove the question from this list.

## Product scope

1. **GTWY AI chatbot and knowledge base.** `public/chatbot.js` (pointing at `chatbot.gtwy.ai`), `app/chatbot`, `hooks/GTWY`, `config/api.ts` and the knowledge-base page at `app/rag` are not described in any doc. Are they part of this product's vision, or a separate product that shares the repository? If they are separate, which vision governs them?
2. **Features without a feature doc.** `docs/MODULE_CHAT_WIDGET.md` requires every major feature to have its own doc. The following are implemented but have none: co-browsing and screen sharing, video-call messages, incoming web calls, interactive, carousel and Apple interactive messages, feedback messages, push-notification previews, thread history, multiple widgets on one page, anonymous-to-known chat merging, prefilled messages and in-app WebView storage fallbacks. Which of these are approved direction, and which should be documented, reworked or retired?
3. **Reply "Future Enhancements".** Are the items in `docs/MODULE_CHAT_WIDGET_REPLY.md` an approved roadmap or only ideas?
4. **Root `REPLY_FEATURE.md`.** It duplicates `docs/MODULE_CHAT_WIDGET_REPLY.md`. Should it be kept?

## Audience

5. **Primary persona.** What role does the person who embeds the widget have (developer, marketer, support lead), what is their workflow, and what technical level should the product assume?
6. **Widget configuration.** Who configures widget data (calling, demo mode, theme), and in which tool? Is that admin persona in scope for this repository?
7. **Auditors and compliance.** Is there an audit or compliance persona, for example for data residency, which region routing hints at?
8. **Target surfaces.** Are mobile in-app WebViews (for example the iOS WhatsApp fix in the git history) and native mobile apps target surfaces, or best effort?

## Value and strategy

9. **Differentiators.** What sets this widget apart from alternatives, for each problem in the vision's value table?
10. **Priorities.** What are the current strategic priorities?
11. **Success metrics.** Which metrics define success (for example adoption, conversation volume, response time, call success rate)?

## Consistency with the rules

12. **Hardcoded hosts.** `config/api.ts` (`api.phone91.com`, `flow-api.viasocket.com`) and `public/chatbot.js` contain hardcoded hosts, although `docs/AI_INSTRUCTIONS.md` prohibits them. Are these intentional exceptions or debt to remove?
13. **Production and test differences.** `docs/ARCHITECTURE.md` allows "minor code differences where required" between production (`react-main`) and test. Which differences are intentional?
