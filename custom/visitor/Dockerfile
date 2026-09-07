ARG CHATONE_UI_IMAGE=chatone-visitor:input-focus-20260907
FROM ${CHATONE_UI_IMAGE}
COPY --chown=node:node client/dist /app/client/dist
COPY --chown=node:node api/server/index.js /app/api/server/index.js
COPY --chown=node:node api/server/routes/index.js /app/api/server/routes/index.js
COPY --chown=node:node api/server/routes/admin/jojoo.js /app/api/server/routes/admin/jojoo.js
COPY --chown=node:node api/server/routes/admin/visitorQuota.js /app/api/server/routes/admin/visitorQuota.js
COPY --chown=node:node custom/visitor/server.cjs /app/custom/visitor/server.cjs
COPY --chown=node:node custom/visitor/knowledge /app/custom/visitor/knowledge
