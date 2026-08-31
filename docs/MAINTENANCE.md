# ChatOne maintenance

ChatOne keeps product-specific work isolated from LibreChat wherever practical. The preferred
change order is configuration, extension, override, then upstream core edits only when necessary.

## Remotes

- `origin`: the public ChatOne repository used for every maintained release.
- `upstream`: `https://github.com/danny-avila/LibreChat.git`.

## Every update

1. Work on `main` or a short-lived `codex/*` branch.
2. Keep secrets only in `.env` or the macOS application-support directories.
3. Run `npm run test:chatone`.
4. Run `docker compose build api` and confirm `docker compose up -d` stays healthy.
5. Run `npm run macos:build` and verify the signed `dist/ChatOne.app` bundle.
6. When full Xcode is installed, run `npm run ios:build` as well.
7. Review the exact Git manifest and scan changed/new files for credentials and private exports.
8. Commit the verified change and push it to `origin main`.

Never publish `.env`, OAuth credentials, ChatGPT account identifiers, MongoDB data, exported
conversations, uploads, local logs, screenshots containing private conversations, or build output.

## Updating LibreChat

```bash
git fetch upstream --tags
git switch -c codex/librechat-update
git merge --no-commit <verified-upstream-tag-or-commit>
```

Resolve conflicts by preserving `custom/`, `librechat.yaml`, the ChatOne model registry, the
subscription bridge, and the small component-level UI overrides. Re-run the complete verification
list above before merging the update into `main` and pushing it to GitHub.

Do not blindly overwrite `.env`, `librechat.yaml`, Docker volumes, or the macOS application-support
directories during an upstream update.
