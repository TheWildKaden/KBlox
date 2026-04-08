# KBlox
Single-file Tampermonkey script that improves Roblox website animations and colors.

- Install: `kblox.user.js`

Notes:
- Uses `@require` to load pinned libraries from unpkg (css-tree + tinycolor2).
- Optionally fetches Roblox CSS from `roblox.com` / `rbxcdn.com`, rewrites color values, and injects the rewritten CSS after the originals.
